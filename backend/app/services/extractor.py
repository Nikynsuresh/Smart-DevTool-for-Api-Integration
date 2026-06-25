import re
import json
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def extract_endpoints_with_regex(text: str) -> List[Dict[str, Any]]:
    """
    Scans documentation text using regular expressions to detect endpoints.
    Detects patterns like:
      GET /users
      POST /payments
      PUT /customers/{id}
      DELETE /orders/{id}
    Extracts HTTP method, endpoint path, parameters, request body, and response body examples.
    """
    # Regex to match method followed by path
    # e.g., POST /v1/payments or GET /users/{id}
    pattern = re.compile(
        r'\b(GET|POST|PUT|DELETE|PATCH)\b\s+([a-zA-Z0-9_\-\/\{\}\:\#\<\>]+)', 
        re.IGNORECASE
    )
    
    matches = pattern.findall(text)
    endpoints = []
    seen = set()
    
    for method, path in matches:
        method = method.upper()
        # Clean path (strip trailing punctuation, quotes, trailing brackets)
        path = path.strip().rstrip('.,;)"\'`')
        if not path.startswith('/'):
            continue
            
        key = (method, path)
        if key in seen:
            continue
        seen.add(key)
        
        # Search the surrounding context (e.g. 1500 chars before and after)
        # to find parameters and JSON examples.
        pos = text.find(path)
        context = ""
        if pos != -1:
            start = max(0, pos - 200)
            end = min(len(text), pos + 1500)
            context = text[start:end]
            
        # Parse query parameters / path parameters
        parameters = []
        # Pattern to match parameter lines like: "id (string) - The user ID" or "amount (required, integer)"
        param_pattern = re.compile(
            r'(?:^|\n|\|)\s*\*?([a-zA-Z0-9_\-\[\]]+)\*?\s+\(?([a-zA-Z0-9_,\s]+)\)?\s*(?:-|:)\s*(.+?)(?=\n|\||$)',
            re.IGNORECASE
        )
        param_matches = param_pattern.findall(context)
        for p_name, p_info, p_desc in param_matches[:10]:
            p_info_lower = p_info.lower()
            required = "required" in p_info_lower or "true" in p_info_lower
            # clean type info
            p_type = p_info_lower.replace("required", "").replace("optional", "").replace(",", "").strip()
            if not p_type:
                p_type = "string"
            parameters.append({
                "name": p_name.strip(),
                "type": p_type,
                "required": required,
                "description": p_desc.strip()
            })
            
        # Extract path parameters from the endpoint path itself (e.g., {id} or :id)
        path_params = re.findall(r'\{([a-zA-Z0-9_\-]+)\}', path)
        for param in path_params:
            # check if already in parameters
            if not any(p["name"] == param for p in parameters):
                parameters.insert(0, {
                    "name": param,
                    "type": "string",
                    "required": True,
                    "description": f"Path parameter {param}"
                })
                
        # Look for JSON request/response examples in the context
        # We search for json markdown code blocks or raw JSON structures
        json_blocks = re.findall(r'```(?:json)?\s*(\{.*?\})\s*```', context, re.DOTALL)
        if not json_blocks:
            # Fallback to search for raw curly brace blocks
            json_blocks = re.findall(r'(\{\s*"[a-zA-Z0-9_]+"\s*:.*?\})', context, re.DOTALL)
            
        request_body_example = ""
        response_body_example = ""
        
        # Clean extracted json strings
        cleaned_json_blocks = []
        for block in json_blocks:
            try:
                # Validate JSON structure
                parsed = json.loads(block)
                cleaned_json_blocks.append(json.dumps(parsed, indent=2))
            except Exception:
                # If invalid json, try to sanitize it first
                sanitized = re.sub(r'//.*', '', block)  # remove comments
                try:
                    parsed = json.loads(sanitized)
                    cleaned_json_blocks.append(json.dumps(parsed, indent=2))
                except Exception:
                    pass
                    
        # Assign first json block to request (if POST/PUT/PATCH) and second to response,
        # or first to response if GET/DELETE
        if cleaned_json_blocks:
            if method in ["POST", "PUT", "PATCH"]:
                request_body_example = cleaned_json_blocks[0]
                if len(cleaned_json_blocks) > 1:
                    response_body_example = cleaned_json_blocks[1]
            else:
                response_body_example = cleaned_json_blocks[0]
                
        endpoints.append({
            "method": method,
            "path": path,
            "description": f"Integrate endpoint: {method} {path}",
            "parameters": parameters,
            "request_body_example": request_body_example,
            "response_body_example": response_body_example
        })
        
    return endpoints

def detect_authentication(text: str) -> Dict[str, Any]:
    """
    Scans the documentation text to detect authentication schemes and configurations.
    Identifies Bearer Token, API Key, OAuth, or Basic Authentication.
    """
    text_lower = text.lower()
    detected_methods = []
    auth_details = {}
    
    # Bearer Token
    if "bearer" in text_lower or "authorization: bearer" in text_lower or "bearer token" in text_lower:
        detected_methods.append("Bearer Token")
        auth_details["bearer"] = {
            "type": "Bearer Token",
            "header": "Authorization",
            "format": "Bearer <token>",
            "description": "API requests must include an Authorization header containing a Bearer token."
        }
        
    # API Key
    api_key_patterns = [
        r"api[-_]?key", 
        r"x-api-key", 
        r"api[-_]?token", 
        r"apikey", 
        r"access[-_]?token", 
        r"authorization[-_]?key"
    ]
    if any(re.search(pat, text_lower) for pat in api_key_patterns):
        detected_methods.append("API Key")
        # Try to guess header or query name
        header_name = "X-API-Key"
        if "x-api-key" in text_lower:
            header_name = "X-API-Key"
        elif "api-key" in text_lower:
            header_name = "API-Key"
        
        auth_details["api_key"] = {
            "type": "API Key",
            "header_name": header_name,
            "description": f"API requests must include an API Key in the headers (e.g. {header_name}) or as a query parameter."
        }
        
    # OAuth
    if "oauth" in text_lower or "oauth2" in text_lower or "client_credentials" in text_lower or "grant_type" in text_lower:
        detected_methods.append("OAuth")
        auth_details["oauth"] = {
            "type": "OAuth 2.0",
            "flows": ["client_credentials"] if "client_credentials" in text_lower else ["client_credentials", "authorization_code"],
            "description": "OAuth 2.0 authentication. Client credentials flow or authorization flow required to retrieve access token."
        }
        
    # Basic Auth
    if "basic auth" in text_lower or "basic authentication" in text_lower or "authorization: basic" in text_lower:
        detected_methods.append("Basic Authentication")
        auth_details["basic"] = {
            "type": "Basic Authentication",
            "header": "Authorization",
            "format": "Basic <base64-credentials>",
            "description": "Username and password sent via standard HTTP Basic Authentication."
        }
        
    # Fallback to API Key if nothing else is found
    if not detected_methods:
        detected_methods.append("API Key")
        auth_details["api_key"] = {
            "type": "API Key",
            "header_name": "Authorization",
            "description": "Default API Key authentication fallback. Provide your token/key in request headers."
        }
        
    # Check if a paid subscription/billing is required based on documentation keywords
    requires_sub = False
    sub_keywords = [
        "pricing plan", "subscription plan", "paid tier", "premium tier", 
        "billing plan", "pricing tier", "upgrade plan", "paid subscription", 
        "requires subscription", "requires upgrade", "payment required", "billing required"
    ]
    if any(kw in text_lower for kw in sub_keywords):
        requires_sub = True
        
    primary_method = detected_methods[0]
    
    return {
        "auth_method": primary_method,
        "all_detected_methods": detected_methods,
        "details": auth_details,
        "requires_subscription": requires_sub,
        "json_summary": json.dumps({
            "primary": primary_method,
            "methods": detected_methods,
            "details": auth_details,
            "requires_subscription": requires_sub
        }, indent=2)
    }

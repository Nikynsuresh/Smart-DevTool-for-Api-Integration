import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Integration
from app.services.exporter import ExporterService

router = APIRouter(prefix="/integrations", tags=["Exports"])

@router.get("/{id}/export/code")
def export_code(id: int, db: Session = Depends(get_db)):
    """Export and download the generated wrapper code file packaged in a ZIP archive with docs and sample script."""
    import io
    import zipfile
    import re
    from urllib.parse import urlparse

    integration = db.query(Integration).filter(Integration.id == id).first()
    if not integration or not integration.generated_code:
        raise HTTPException(status_code=404, detail="Code not generated or integration not found")
        
    lang = integration.language.lower()
    
    # Determine correct file extension and filenames
    if "python" in lang:
        client_filename = "api_client.py"
        example_filename = "example.py"
    elif "typescript" in lang or "ts" in lang:
        client_filename = "apiClient.ts"
        example_filename = "example.ts"
    elif "javascript" in lang or "js" in lang:
        client_filename = "apiClient.js"
        example_filename = "example.js"
    elif "go" in lang:
        client_filename = "apiclient.go"
        example_filename = "example.go"
    elif "java" in lang:
        client_filename = "ApiClient.java"
        example_filename = "Example.java"
    else:
        client_filename = "api_client.txt"
        example_filename = "example.txt"

    # Extract class name from code if possible
    class_name = "ApiClient"
    try:
        if "python" in lang:
            match = re.search(r"class\s+([a-zA-Z0-9_]+)\b", integration.generated_code)
            if match:
                class_name = match.group(1)
        elif "typescript" in lang or "ts" in lang or "javascript" in lang or "js" in lang:
            match = re.search(r"class\s+([a-zA-Z0-9_]+)\b", integration.generated_code)
            if match:
                class_name = match.group(1)
        elif "go" in lang:
            match = re.search(r"type\s+([a-zA-Z0-9_]+)\s+struct", integration.generated_code)
            if match:
                class_name = match.group(1)
        elif "java" in lang:
            match = re.search(r"public\s+class\s+([a-zA-Z0-9_]+)\b", integration.generated_code)
            if match:
                class_name = match.group(1)
    except Exception:
        pass

    # Extract code snippet from sample requests
    example_code = ""
    if integration.sample_requests:
        try:
            # Find all code blocks enclosed in ``` ... ```
            blocks = re.findall(r"```[a-zA-Z]*\n(.*?)\n```", integration.sample_requests, re.DOTALL)
            if blocks:
                example_code = "\n\n".join(blocks)
            else:
                example_code = integration.sample_requests
        except Exception:
            pass

    # Fallback default runnable boilerplate if example_code is empty or too short
    if not example_code or len(example_code.strip()) < 10:
        if "python" in lang:
            example_code = f"""import os
import asyncio
from {client_filename[:-3]} import {class_name}

# Make sure to install dependencies (e.g. pip install requests httpx)
# Set your environment variables in your terminal or a .env file:
# os.environ["API_KEY"] = "your_api_key_here"

async def main():
    print("Initializing client...")
    client = {class_name}()
    
    print("Calling API...")
    try:
        # Example call (verify exact method names in {client_filename}):
        # response = client.get_data()
        # print("Response:", response)
        pass
    except Exception as e:
        print("API Call failed:", e)

if __name__ == "__main__":
    asyncio.run(main())
"""
        elif "typescript" in lang or "ts" in lang:
            example_code = f"""import {{ {class_name} }} from "./{client_filename[:-3]}";

// Make sure to install dependencies (e.g. npm install axios dotenv)
// Configure environment variables in your environment or a .env file.

async function main() {{
  console.log("Initializing client...");
  const client = new {class_name}();

  console.log("Calling API...");
  try {{
    // Example call (verify exact method names in {client_filename}):
    // const response = await client.getData();
    // console.log("Response:", response);
  }} catch (error) {{
    console.error("API Call failed:", error);
  }}
}}

main();
"""
        elif "javascript" in lang or "js" in lang:
            example_code = f"""const {{ {class_name} }} = require("./{client_filename}");

// Make sure to install dependencies (e.g. npm install axios dotenv)
// Configure environment variables in your environment or a .env file.

async function main() {{
  console.log("Initializing client...");
  const client = new {class_name}();

  console.log("Calling API...");
  try {{
    // Example call (verify exact method names in {client_filename}):
    // const response = await client.getData();
    // console.log("Response:", response);
  }} catch (error) {{
    console.error("API Call failed:", error);
  }}
}}

main();
"""
        elif "go" in lang:
            example_code = f"""package main

import (
	"context"
	"fmt"
	"log"
)

// Run: go run example.go
func main() {{
	fmt.Println("Initializing client...")
	// Instantiate your client. Make sure packages match.
	// client := NewClient()

	fmt.Println("Calling API...")
	// ctx := context.Background()
	// resp, err := client.GetData(ctx)
	// if err != nil {{
	// 	log.Fatalf("API call failed: %v", err)
	// }}
	// fmt.Printf("Response: %v\\n", resp)
}}
"""
        elif "java" in lang:
            example_code = f"""public class Example {{
    public static void main(String[] args) {{
        System.out.println("Initializing client...");
        try {{
            // Instantiate your client (verify constructor requirements in {client_filename}):
            // {class_name} client = new {class_name}();
            // System.out.println("Calling API...");
            // Object response = client.getData();
            // System.out.println("Response: " + response.toString());
        }} catch (Exception e) {{
            System.err.println("API Call failed: " + e.getMessage());
            e.printStackTrace();
        }}
    }}
}}
"""
        else:
            example_code = f"# Example usage for {class_name}\n# Verify methods in {client_filename}"

    # Generate custom README.md text
    parsed_url = urlparse(integration.url)
    host = parsed_url.netloc or "API"
    
    # Formulate environment variables setup guide based on detected auth details
    auth_summary_lower = (integration.auth_summary or "").lower()
    env_keys_lines = []
    if "bearer" in auth_summary_lower or "token" in auth_summary_lower:
        env_keys_lines.append("API_TOKEN=your_bearer_token_here")
    if "api-key" in auth_summary_lower or "apikey" in auth_summary_lower or "x-api-key" in auth_summary_lower:
        env_keys_lines.append("API_KEY=your_api_key_here")
    if not env_keys_lines:
        env_keys_lines.append("API_KEY=your_credentials_here")
    env_keys_str = "\n".join(env_keys_lines)

    readme_content = f"""# {host} Client SDK

This client library and helper files were generated by **Smart DevTool** to speed up API integration.

## Folder Contents
- `{client_filename}`: The custom SDK client class wrapper implementing the methods.
- `{example_filename}`: A runnable example script showing import and basic method calling.
- `README.md`: This user guide and documentation.

## How to Get Started

### 1. Requirements & Dependencies
Before running the code, ensure your environment has the required HTTP client packages installed:
"""
    if "python" in lang:
        readme_content += """```bash
pip install requests urllib3 python-dotenv
```
"""
    elif "typescript" in lang or "ts" in lang or "javascript" in lang or "js" in lang:
        readme_content += """```bash
npm install axios dotenv
```
"""
    elif "go" in lang:
        readme_content += """```bash
go get -u github.com/go-resty/resty/v2
```
"""
    else:
        readme_content += "- Ensure an HTTP client library is installed in your target environment.\n"

    readme_content += f"""
### 2. Configure Authentication
Create a `.env` file in the root of your project folder containing:
```env
{env_keys_str}
```

### 3. Running the Code
Verify and run the sample script to check the connection:
"""
    if "python" in lang:
        readme_content += """```bash
python example.py
```
"""
    elif "typescript" in lang or "ts" in lang:
        readme_content += """```bash
npx ts-node example.ts
```
"""
    elif "javascript" in lang or "js" in lang:
        readme_content += """```bash
node example.js
```
"""
    elif "go" in lang:
        readme_content += """```bash
go run example.go
```
"""
    elif "java" in lang:
        readme_content += """```bash
javac Example.java ApiClient.java
java Example
```
"""
    else:
        readme_content += "- Execute the example file using your language's standard compiler/runtime.\n"

    readme_content += f"""
## Detailed Integration Steps
Below is the full guide automatically compiled from the documentation:

{integration.integration_steps or "No detailed guide generated."}

---
Generated by Smart DevTool for API Integration.
"""

    # Build the in-memory zip archive
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr(client_filename, integration.generated_code)
        zip_file.writestr("README.md", readme_content)
        zip_file.writestr(example_filename, example_code)
        
    zip_buffer.seek(0)
    
    # Return as zip streaming response
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=sdk_client_{id}.zip"}
    )

@router.get("/{id}/export/postman")
def export_postman(id: int, db: Session = Depends(get_db)):
    """Export and download Postman Collection JSON."""
    integration = db.query(Integration).filter(Integration.id == id).first()
    if not integration or not integration.endpoints_json:
        raise HTTPException(status_code=404, detail="Endpoints not extracted or integration not found")
        
    try:
        endpoints = json.loads(integration.endpoints_json)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse saved endpoint details")
        
    auth_summary = integration.auth_summary or ""
    
    # Parse base URL from original url
    from urllib.parse import urlparse
    parsed = urlparse(integration.url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    
    collection = ExporterService.generate_postman_collection(
        integration_name=f"{parsed.netloc} API",
        base_url=base_url,
        endpoints=endpoints,
        auth_summary=auth_summary
    )
    
    collection_str = json.dumps(collection, indent=2)
    
    return Response(
        content=collection_str,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=postman_collection_{id}.json"}
    )

@router.get("/{id}/export/pdf")
def export_pdf(id: int, db: Session = Depends(get_db)):
    """Export and download a formatted PDF API report."""
    integration = db.query(Integration).filter(Integration.id == id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    if not integration.endpoints_json or not integration.generated_code:
        raise HTTPException(status_code=400, detail="Integration analysis is incomplete")
        
    try:
        endpoints = json.loads(integration.endpoints_json)
    except Exception:
        endpoints = []
        
    # Generate PDF bytes
    pdf_bytes = ExporterService.generate_openapi_pdf(
        url=integration.url,
        use_case=integration.use_case,
        auth_summary=integration.auth_summary or "",
        endpoints=endpoints,
        generated_code=integration.generated_code
    )
    
    # Return as download stream
    import io
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=api_report_{id}.pdf"}
    )

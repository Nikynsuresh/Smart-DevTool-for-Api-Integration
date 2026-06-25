import json
import os
import io
import re
from typing import List, Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

class ExporterService:
    @staticmethod
    def generate_postman_collection(integration_name: str, base_url: str, endpoints: List[Dict[str, Any]], auth_summary: str) -> Dict[str, Any]:
        """Generate a valid Postman Collection v2.1.0 JSON representation."""
        # Detect authorization headers from auth summary
        headers = [{"key": "Content-Type", "value": "application/json"}]
        
        # Simple heuristic to add typical auth headers to Postman
        auth_lower = auth_summary.lower()
        if "bearer" in auth_lower or "token" in auth_lower:
            headers.append({"key": "Authorization", "value": "Bearer {{api_key}}", "type": "text"})
        elif "x-api-key" in auth_lower:
            headers.append({"key": "X-API-Key", "value": "{{api_key}}", "type": "text"})
            
        postman_items = []
        for index, ep in enumerate(endpoints):
            path_cleaned = ep.get("path", "").strip()
            # Split path for Postman's url.path property
            path_parts = [p for p in path_cleaned.split("/") if p]
            
            method = ep.get("method", "GET").upper()
            description = ep.get("description", f"Endpoint {index+1}")
            
            # Setup body
            body_data = {}
            if method in ["POST", "PUT", "PATCH"]:
                body_example = ep.get("request_body_example", "")
                # If it's a string representing JSON, use it, otherwise format
                if body_example:
                    body_data = {
                        "mode": "raw",
                        "raw": body_example
                    }
            
            item = {
                "name": f"{method} {path_cleaned} - {description[:40]}",
                "request": {
                    "method": method,
                    "header": headers,
                    "url": {
                        "raw": "{{base_url}}" + path_cleaned,
                        "host": ["{{base_url}}"],
                        "path": path_parts
                    },
                    "description": description
                },
                "response": []
            }
            
            if body_data:
                item["request"]["body"] = body_data
                
            postman_items.append(item)
            
        # Complete collection
        collection = {
            "info": {
                "name": f"Smart DevTool - {integration_name or 'API Export'}",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": postman_items,
            "variable": [
                {
                    "key": "base_url",
                    "value": base_url or "https://api.example.com",
                    "type": "string"
                },
                {
                    "key": "api_key",
                    "value": "YOUR_API_KEY_HERE",
                    "type": "string"
                }
            ]
        }
        return collection

    @staticmethod
    def escape_for_reportlab(text: str) -> str:
        if not text:
            return ""
        text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
        text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
        text = re.sub(r'`(.*?)`', r'<code>\1</code>', text)
        text = text.replace("\n", "<br/>")
        return text

    @staticmethod
    def generate_openapi_pdf(url: str, use_case: str, auth_summary: str, endpoints: List[Dict[str, Any]], generated_code: str) -> bytes:
        """Generate a polished PDF summary report of the API integration."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54
        )
        
        styles = getSampleStyleSheet()
        
        # Custom Styles (Premium Feel)
        primary_color = colors.HexColor("#4f46e5")  # Sleek Indigo
        secondary_color = colors.HexColor("#1e1b4b")  # Dark Navy
        text_color = colors.HexColor("#334155")  # Slate Gray
        
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=26,
            textColor=primary_color,
            spaceAfter=20,
            alignment=TA_LEFT
        )
        
        subtitle_style = ParagraphStyle(
            'DocSubTitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=12,
            textColor=secondary_color,
            spaceAfter=30
        )
        
        h1_style = ParagraphStyle(
            'SectionH1',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=16,
            textColor=secondary_color,
            spaceBefore=18,
            spaceAfter=10,
            keepWithNext=True
        )
        
        body_style = ParagraphStyle(
            'BodyText',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=text_color,
            spaceAfter=8,
            leading=14
        )
        
        code_style = ParagraphStyle(
            'CodeBlock',
            parent=styles['Normal'],
            fontName='Courier',
            fontSize=8,
            textColor=colors.HexColor("#0f172a"),
            backgroundColor=colors.HexColor("#f1f5f9"),
            borderPadding=8,
            spaceAfter=12,
            leading=10
        )
        
        story = []
        
        # Title Page / Header
        story.append(Paragraph("Smart DevTool: API Integration Report", title_style))
        escaped_url = ExporterService.escape_for_reportlab(url)
        escaped_use_case = ExporterService.escape_for_reportlab(use_case)
        story.append(Paragraph(f"<b>Base URL:</b> {escaped_url}<br/><b>Generated On:</b> 2026-06-25<br/><b>Use Case:</b> {escaped_use_case}", subtitle_style))
        story.append(Spacer(1, 10))
        
        # Section 1: Authentication
        story.append(Paragraph("Authentication Setup", h1_style))
        auth_html = ExporterService.escape_for_reportlab(auth_summary or "")
        story.append(Paragraph(auth_html, body_style))
        story.append(Spacer(1, 15))
        
        # Section 2: Endpoints
        story.append(Paragraph("Relevant Endpoints", h1_style))
        
        for ep in endpoints:
            method = ep.get("method", "GET").upper()
            path = ExporterService.escape_for_reportlab(ep.get("path", ""))
            desc = ExporterService.escape_for_reportlab(ep.get("description", "No description provided."))
            
            # Draw Endpoint card/table
            ep_header_style = ParagraphStyle(
                'EpHeader',
                parent=styles['Normal'],
                fontName='Helvetica-Bold',
                fontSize=11,
                textColor=colors.white
            )
            
            method_color = colors.HexColor("#22c55e") if method == "GET" else colors.HexColor("#3b82f6") if method == "POST" else colors.HexColor("#f59e0b")
            
            # Simple metadata table
            data = [
                [Paragraph(f"<b>{method}</b> {path}", ep_header_style)],
                [Paragraph(f"<b>Description:</b> {desc}", body_style)]
            ]
            
            # Extract parameters if exist
            params = ep.get("parameters", [])
            if params:
                param_lines = []
                for p in params:
                    p_name = ExporterService.escape_for_reportlab(p.get('name', ''))
                    p_type = ExporterService.escape_for_reportlab(p.get('type', ''))
                    p_desc = ExporterService.escape_for_reportlab(p.get('description', ''))
                    req_str = " (Required)" if p.get("required") else ""
                    param_lines.append(f"- <b>{p_name}</b> ({p_type}){req_str}: {p_desc}")
                param_text = "<br/>".join(param_lines)
                data.append([Paragraph(f"<b>Parameters:</b><br/>{param_text}", body_style)])
                
            req_example = ep.get("request_body_example", "")
            if req_example:
                escaped_req = ExporterService.escape_for_reportlab(req_example)
                data.append([Paragraph(f"<b>Request Body Example:</b><br/><code>{escaped_req}</code>", body_style)])
                
            res_example = ep.get("response_body_example", "")
            if res_example:
                escaped_res = ExporterService.escape_for_reportlab(res_example)
                data.append([Paragraph(f"<b>Response Example:</b><br/><code>{escaped_res}</code>", body_style)])

            t = Table(data, colWidths=[500])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), method_color),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white])
            ]))
            
            story.append(t)
            story.append(Spacer(1, 15))
            
        story.append(PageBreak())
        
        # Section 3: Generated Wrapper Code Preview
        story.append(Paragraph("Generated Wrapper Code Preview", h1_style))
        story.append(Paragraph("Below is a preview of the generated integration class. The full code is available for export.", body_style))
        
        # Truncate preview to fit PDF nicely if long
        code_preview = generated_code
        lines = code_preview.split("\n")
        if len(lines) > 80:
            code_preview = "\n".join(lines[:80]) + "\n\n... (Code truncated for PDF preview) ..."
            
        # Escape HTML entities for reportlab paragraph rendering
        code_escaped = code_preview.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>").replace(" ", "&nbsp;")
        story.append(Paragraph(code_escaped, code_style))
        
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

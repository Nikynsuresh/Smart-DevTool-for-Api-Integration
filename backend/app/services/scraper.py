import logging
import requests
import re
import asyncio
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from app.config import settings

logger = logging.getLogger(__name__)

class DocumentationScraper:
    def __init__(self, max_pages: int = None):
        self.max_pages = max_pages or settings.MAX_CRAWL_PAGES
        self.visited_urls = set()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5"
        }

    def _is_valid_url(self, base_url: str, url: str) -> bool:
        """Verify URL is in the same domain and hierarchy, and isn't a static asset."""
        parsed_base = urlparse(base_url)
        parsed_url = urlparse(url)
        
        # Check domain match
        if parsed_base.netloc != parsed_url.netloc:
            return False
            
        # Ensure it starts with base path (or is within doc path)
        if not parsed_url.path.startswith(parsed_base.path.rstrip('/')):
            # Allow general sibling docs paths
            if not ('doc' in parsed_url.path or 'api' in parsed_url.path):
                return False

        # Exclude common assets & file extensions
        excluded_exts = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.zip', '.tar', '.gz', '.css', '.js', '.json', '.xml'}
        path_lower = parsed_url.path.lower()
        if any(path_lower.endswith(ext) for ext in excluded_exts):
            return False
            
        # Exclude anchor jumps on the same page
        if parsed_url.fragment and parsed_url.path == parsed_base.path:
            return False

        return True

    def _clean_html(self, html_content: str, url: str) -> str:
        """Strip navigation, footers, ads and return cleaner structured markdown-like content."""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove script, style, noscript, iframe, header, footer, nav, aside, and form elements
        for element in soup(["script", "style", "noscript", "iframe", "header", "footer", "nav", "aside", "form"]):
            element.decompose()
            
        # Remove elements by common class/id patterns that look like nav, sidebar, footer, ads
        for element in soup.find_all(class_=re.compile(r'nav|sidebar|footer|ad-wrapper|menu|header|breadcrumb|pagination', re.I)):
            element.decompose()
        for element in soup.find_all(id=re.compile(r'nav|sidebar|footer|menu|header|breadcrumb', re.I)):
            element.decompose()

        # Try to find the main content container
        content_selectors = ['main', '#content', '.content', '#docs-content', '.docs-content', 'article', '#body']
        main_content = None
        for selector in content_selectors:
            if selector.startswith('.'):
                main_content = soup.find(class_=selector[1:])
            elif selector.startswith('#'):
                main_content = soup.find(id=selector[1:])
            else:
                main_content = soup.find(selector)
            if main_content:
                break
                
        target_soup = main_content if main_content else soup.body
        if not target_soup:
            target_soup = soup
            
        # Extract headers, paragraphs, lists, tables, and code snippets
        structured_lines = []
        
        for element in target_soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'pre', 'table', 'ul', 'ol']):
            if element.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                level = int(element.name[1])
                structured_lines.append(f"\n{'#' * level} {element.get_text(strip=True)}\n")
            elif element.name == 'p':
                text = element.get_text(strip=True)
                if text:
                    structured_lines.append(f"{text}\n")
            elif element.name == 'pre':
                # Code snippet preservation
                code_tag = element.find('code')
                code_text = code_tag.get_text() if code_tag else element.get_text()
                # Try to extract language from class
                lang = ""
                if code_tag and code_tag.has_attr('class'):
                    for cls in code_tag['class']:
                        if cls.startswith('language-') or cls.startswith('lang-'):
                            lang = cls.replace('language-', '').replace('lang-', '')
                            break
                structured_lines.append(f"\n```{lang}\n{code_text.strip()}\n```\n")
            elif element.name == 'table':
                # Beautiful markdown table generator
                rows = element.find_all('tr')
                if rows:
                    table_md = []
                    for i, row in enumerate(rows):
                        cols = [col.get_text(strip=True) for col in row.find_all(['td', 'th'])]
                        if cols:
                            table_md.append("| " + " | ".join(cols) + " |")
                            if i == 0:  # Header separator
                                table_md.append("| " + " | ".join(['---'] * len(cols)) + " |")
                    structured_lines.append("\n" + "\n".join(table_md) + "\n")
            elif element.name in ['ul', 'ol']:
                # List conversion
                for li in element.find_all('li', recursive=False):
                    structured_lines.append(f"- {li.get_text(strip=True)}")
                structured_lines.append("")

        return f"Source URL: {url}\n\n" + "\n".join(structured_lines)

    async def crawl(self, start_url: str, progress_callback=None) -> list[dict]:
        """Crawl the documentation site starting at start_url using requests and BeautifulSoup."""
        self.visited_urls.clear()
        queue = [start_url]
        pages_data = []
        
        logger.info(f"Starting crawl for {start_url} using requests and BeautifulSoup")
        
        while queue and len(self.visited_urls) < self.max_pages:
            current_url = queue.pop(0)
            if current_url in self.visited_urls:
                continue
                
            self.visited_urls.add(current_url)
            logger.info(f"Crawling ({len(self.visited_urls)}/{self.max_pages}): {current_url}")
            
            if progress_callback:
                current_pct = int(5 + (len(self.visited_urls) / self.max_pages) * 35)
                await progress_callback(current_pct, f"Crawling: {current_url}")
                
            try:
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(
                    None, 
                    lambda: requests.get(current_url, headers=self.headers, timeout=10)
                )
                
                if response.status_code != 200:
                    logger.warning(f"Failed to fetch {current_url}: HTTP {response.status_code}")
                    if current_url == start_url:
                        status_desc = {
                            401: "401 Unauthorized - The site requires authentication credentials.",
                            403: "403 Forbidden - Access is blocked. The website may be protecting itself from automated scrapers via WAF/Cloudflare.",
                            404: "404 Not Found - The specified documentation path does not exist on this domain.",
                            500: "500 Internal Server Error - The server encountered an error serving this page.",
                            502: "502 Bad Gateway - The upstream server returned an invalid response.",
                            503: "503 Service Unavailable - The server is temporarily overloaded or down.",
                            504: "504 Gateway Timeout - The gateway timed out waiting for the upstream server."
                        }.get(response.status_code, f"HTTP Status {response.status_code}")
                        raise ValueError(f"Failed to access the documentation homepage: {status_desc}")
                    continue
                    
                html = response.text
                
                # Parse title using BeautifulSoup
                soup = BeautifulSoup(html, 'html.parser')
                title_tag = soup.find('title')
                title = title_tag.get_text(strip=True) if title_tag else current_url
                
                # Clean and parse content
                cleaned_content = self._clean_html(html, current_url)
                
                pages_data.append({
                    "url": current_url,
                    "title": title,
                    "content": cleaned_content
                })
                
                # Extract relative links
                for link_tag in soup.find_all("a", href=True):
                    href = link_tag["href"]
                    full_url = urljoin(current_url, href).split('#')[0]  # strip fragment
                    if self._is_valid_url(start_url, full_url) and full_url not in self.visited_urls and full_url not in queue:
                        queue.append(full_url)
                        
            except Exception as e:
                logger.warning(f"Error crawling {current_url}: {e}")
                if current_url == start_url:
                    error_msg = str(e)
                    if "connection refused" in error_msg.lower():
                        raise ValueError("Connection Refused - The server at this address is not responding or is blocking requests on this port.")
                    elif "name or service not known" in error_msg.lower() or "dns" in error_msg.lower() or "failed to resolve" in error_msg.lower():
                        raise ValueError("DNS Resolution Failed - Failed to resolve the hostname. Double check that the domain name is typed correctly.")
                    elif "ssl" in error_msg.lower() or "certificate verify failed" in error_msg.lower():
                        raise ValueError("SSL Verification Failed - Failed to establish a secure SSL/TLS connection. The certificate might be expired, invalid, or self-signed.")
                    elif "timeout" in error_msg.lower():
                        raise ValueError("Connection Timeout - The request timed out. The server took too long to respond.")
                    raise ValueError(f"Network error while connecting to documentation: {error_msg}")
                continue
                
        logger.info(f"Crawl completed. Crawled {len(pages_data)} pages.")
        return pages_data

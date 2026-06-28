import logging
import re
import asyncio
import time
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import httpx
from playwright.async_api import async_playwright
from app.config import settings

logger = logging.getLogger(__name__)

class DocumentationScraper:
    def __init__(self, max_pages: int = None):
        self.max_pages = max_pages or settings.MAX_CRAWL_PAGES
        self.visited_urls = set()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
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
            
        # If the base URL is just the root domain, we must be strict and only allow doc/api paths
        base_path = parsed_base.path.rstrip('/')
        path_lower = parsed_url.path.lower()
        doc_keywords = {'doc', 'api', 'dev', 'reference', 'guide', 'spec', 'swagger', 'openapi', 'v1', 'v2', 'v3', 'endpoint'}
        
        if not base_path:
            # Root domain: subpage path must contain api/doc related keywords
            if not any(kw in path_lower for kw in doc_keywords):
                return False
        else:
            # Nested path: must start with the base path, or contain doc/api keywords
            if not parsed_url.path.startswith(base_path):
                if not any(kw in path_lower for kw in doc_keywords):
                    return False

        # Exclude common assets & file extensions
        excluded_exts = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.zip', '.tar', '.gz', '.css', '.js', '.json', '.xml'}
        if any(path_lower.endswith(ext) for ext in excluded_exts):
            return False
            
        # Exclude anchor jumps on the same page
        if parsed_url.fragment and parsed_url.path == parsed_base.path:
            return False

        return True

    def _is_javascript_heavy(self, html: str) -> bool:
        """Heuristic check to determine if the page requires JS execution."""
        if not html:
            return True
        # If very short or contains skeleton roots without content
        if len(html) < 3000:
            return True
        if "noscript" in html.lower() or "javascript" in html.lower():
            soup = BeautifulSoup(html, 'html.parser')
            body = soup.body
            if body:
                text_len = len(body.get_text(strip=True))
                # If body is mostly empty but has HTML elements, it is JS-rendered
                if text_len < 400:
                    return True
        return False

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

    async def _fetch_with_httpx(self, client: httpx.AsyncClient, url: str, retries: int = 1) -> str | None:
        """Fetch URL with httpx AsyncClient, handling retries and timeouts."""
        for attempt in range(retries + 1):
            try:
                start_time = time.time()
                response = await client.get(url, headers=self.headers, timeout=4.0)
                duration = time.time() - start_time
                logger.info(f"HTTPX fetch completed: {url} | Status: {response.status_code} | Duration: {duration:.2f}s | Size: {len(response.content)} bytes")
                
                if response.status_code == 200:
                    return response.text
                elif response.status_code in [403, 401]:
                    # Cloudflare WAF block or restriction
                    logger.warning(f"HTTPX request blocked (HTTP {response.status_code}) on: {url}")
                    return None
            except (httpx.RequestError, httpx.TimeoutException) as e:
                logger.warning(f"HTTPX fetch attempt {attempt + 1}/{retries + 1} failed on {url} | Error: {e}")
                if attempt < retries:
                    await asyncio.sleep(0.5 * (2 ** attempt))
        return None

    async def _fetch_with_playwright(self, url: str) -> str | None:
        """Fallback Playwright Chromium browser crawler for JS SPA sites or WAF blocks."""
        logger.info(f"Launching Playwright fallback for URL: {url}")
        start_time = time.time()
        browser = None
        context = None
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
                )
                context = await browser.new_context(
                    user_agent=self.headers["User-Agent"],
                    viewport={"width": 1280, "height": 800}
                )
                page = await context.new_page()
                
                # Navigate and wait for DOM load
                await page.goto(url, wait_until="load", timeout=8000)
                
                # Dynamic delay for SPAs
                try:
                    await page.wait_for_load_state("networkidle", timeout=2000)
                except Exception:
                    pass
                
                html = await page.content()
                duration = time.time() - start_time
                logger.info(f"Playwright fallback completed: {url} | Duration: {duration:.2f}s | Size: {len(html)} bytes")
                return html
        except Exception as e:
            logger.error(f"Playwright fallback failed for {url} | Error: {e}")
            return None
        finally:
            if context:
                await context.close()
            if browser:
                await browser.close()

    async def crawl(self, start_url: str, progress_callback=None) -> list[dict]:
        """Crawl start_url using an async httpx client fast-path with Playwright browser fallback."""
        self.visited_urls.clear()
        pages_data = []
        
        logger.info(f"Beginning crawl for base documentation: {start_url} (max pages: {self.max_pages})")
        if progress_callback:
            await progress_callback(8, f"Fetching base documentation: {start_url}")
            
        # 1. Fetch start page
        html = None
        async with httpx.AsyncClient(follow_redirects=True) as client:
            html = await self._fetch_with_httpx(client, start_url)
            
            if not html or self._is_javascript_heavy(html):
                logger.info(f"Start page is empty, blocked, or JS-heavy. Falling back to browser scraper...")
                html = await self._fetch_with_playwright(start_url)
                
        if not html:
            raise ValueError("Failed to crawl the documentation homepage. The page is unreachable or blocked.")
            
        self.visited_urls.add(start_url)
        soup = BeautifulSoup(html, 'html.parser')
        title_tag = soup.find('title')
        title = title_tag.get_text(strip=True) if title_tag else start_url
        
        pages_data.append({
            "url": start_url,
            "title": title,
            "content": self._clean_html(html, start_url)
        })
        
        if self.max_pages <= 1:
            return pages_data
            
        # 2. Extract links
        candidate_urls = []
        seen_candidates = set()
        for link_tag in soup.find_all("a", href=True):
            href = link_tag["href"]
            full_url = urljoin(start_url, href).split('#')[0]
            if (
                self._is_valid_url(start_url, full_url) 
                and full_url != start_url 
                and full_url not in seen_candidates
            ):
                candidate_urls.append(full_url)
                seen_candidates.add(full_url)
                
        # Limit candidates
        urls_to_fetch = candidate_urls[:self.max_pages - 1]
        if not urls_to_fetch:
            return pages_data
            
        if progress_callback:
            await progress_callback(20, f"Scanning {len(urls_to_fetch)} subpages concurrently...")
            
        # 3. Fetch subpages in parallel
        async def fetch_subpage(url):
            sub_html = None
            async with httpx.AsyncClient(follow_redirects=True) as c:
                sub_html = await self._fetch_with_httpx(c, url)
                if not sub_html or self._is_javascript_heavy(sub_html):
                    sub_html = await self._fetch_with_playwright(url)
                    
            if sub_html:
                sub_soup = BeautifulSoup(sub_html, 'html.parser')
                sub_title_tag = sub_soup.find('title')
                sub_title = sub_title_tag.get_text(strip=True) if sub_title_tag else url
                return {
                    "url": url,
                    "title": sub_title,
                    "content": self._clean_html(sub_html, url)
                }
            return None

        tasks = [fetch_subpage(url) for url in urls_to_fetch]
        results = await asyncio.gather(*tasks)
        
        for res in results:
            if res:
                pages_data.append(res)
                self.visited_urls.add(res["url"])
                
        logger.info(f"Crawl finished. Scraped {len(pages_data)} pages successfully.")
        return pages_data

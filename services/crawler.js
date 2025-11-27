const puppeteer = require('puppeteer');

// Puppeteer 내장 iPhone 디바이스 설정
const iPhone = {
  name: 'iPhone 14 Pro',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  viewport: {
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
};

/**
 * Place ID 추출 (모바일 + PC 링크 모두 지원)
 */
function extractPlaceId(placeUrl) {
  if (!placeUrl) return null;
  const m = placeUrl.match(/\/(?:restaurant|place|entry\/place)\/(\d+)/i);
  return m ? m[1] : null;
}

/**
 * Blog ID/LogNo 추출
 */
function extractBlogInfo(blogUrl) {
  if (!blogUrl) return null;
  // https://blog.naver.com/blogId/logNo
  // https://m.blog.naver.com/blogId/logNo
  // https://blog.naver.com/PostView.naver?blogId=xxx&logNo=123
  
  // 일반 형식
  let m = blogUrl.match(/blog\.naver\.com\/([^\/\?]+)\/(\d+)/i);
  if (m) return { blogId: m[1], logNo: m[2] };
  
  // PostView.naver 형식
  m = blogUrl.match(/blogId=([^&]+).*logNo=(\d+)/i);
  if (m) return { blogId: m[1], logNo: m[2] };
  
  return null;
}

/**
 * Shopping Product ID 추출
 */
function extractProductId(productUrl) {
  if (!productUrl) return null;
  // https://smartstore.naver.com/xxx/products/12345
  // https://search.shopping.naver.com/product/12345
  // https://shopping.naver.com/...nvMid=12345...
  
  let m = productUrl.match(/products?\/(\d+)/i);
  if (m) return m[1];
  
  m = productUrl.match(/nvMid=(\d+)/i);
  if (m) return m[1];
  
  return null;
}

class NaverCrawler {
  constructor() {
    this.browser = null;
  }

  async init() {
    if (!this.browser) {
      console.log('🚀 [Crawler] 브라우저 시작...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--window-size=1280,800',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
        ]
      });
      console.log('✅ [Crawler] 브라우저 시작 완료!');
    }
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 공통 페이지 설정 - 완벽한 모바일 에뮬레이션
   */
  async setupPage(page, isMobile = false) {
    if (isMobile) {
      // 완벽한 모바일 에뮬레이션 (직접 설정)
      await page.setViewport({
        width: 393,
        height: 852,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        isLandscape: false,
      });
      
      await page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      );
      
      // 모바일 속성 주입 (네이버 감지 우회 - 중요!)
      await page.evaluateOnNewDocument(() => {
        // 터치 지원
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
        // 플랫폼을 iPhone으로
        Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
        // 벤더
        Object.defineProperty(navigator, 'vendor', { get: () => 'Apple Computer, Inc.' });
        // 터치 이벤트 지원
        Object.defineProperty(window, 'ontouchstart', { value: () => {} });
        Object.defineProperty(navigator, 'standalone', { get: () => false });
        // screen 정보도 모바일로
        Object.defineProperty(screen, 'width', { get: () => 393 });
        Object.defineProperty(screen, 'height', { get: () => 852 });
        Object.defineProperty(screen, 'availWidth', { get: () => 393 });
        Object.defineProperty(screen, 'availHeight', { get: () => 852 });
      });
      
      console.log('📱 [Page] 모바일 에뮬레이션 설정 완료 (iPhone)');
    } else {
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      console.log('🖥️ [Page] PC 설정 완료');
    }

    // headless 감지 회피 (공통)
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] });
      // Chrome headless 감지 우회
      window.chrome = { runtime: {} };
      // permissions 우회
      const originalQuery = window.navigator.permissions?.query;
      if (originalQuery) {
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      }
    });
  }

  // ============================================================
  // 플레이스 순위 체크 (모바일 + 스크롤 300위까지)
  // ============================================================
  async checkPlaceRank(keyword, placeUrl) {
    console.log(`\n🔍 [플레이스] 순위 체크 시작: "${keyword}"`);
    const startTime = Date.now();

    const targetPlaceId = extractPlaceId(placeUrl);
    console.log(`🎯 [플레이스] 찾는 업체 ID: ${targetPlaceId}, URL: ${placeUrl}`);

    if (!targetPlaceId) {
      return {
        success: false,
        rank: -1,
        error: 'URL에서 Place ID를 추출할 수 없습니다.',
        keyword,
        placeUrl,
      };
    }

    try {
      const browser = await this.init();
      const page = await browser.newPage();
      await this.setupPage(page, true);

      // 키워드에서 지역 좌표 추출 (네이버 지역 검색 API)
      let x = 126.9783882;  // 기본값: 서울
      let y = 37.5666103;
      
      try {
        const axios = require('axios');
        const geoUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(keyword)}&display=1`;
        
        const geoRes = await axios.get(geoUrl, {
          headers: {
            'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
            'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
          },
          timeout: 5000,
        });
        
        if (geoRes.data.items && geoRes.data.items.length > 0) {
          const item = geoRes.data.items[0];
          // KATECH 좌표 → WGS84 변환
          x = parseInt(item.mapx) / 10000000;
          y = parseInt(item.mapy) / 10000000;
          console.log(`📍 [플레이스] 좌표 추출 성공: (${x.toFixed(4)}, ${y.toFixed(4)})`);
        }
      } catch (geoErr) {
        console.log(`⚠️ [플레이스] 좌표 추출 실패, 기본값 사용`);
      }

      // 좌표 포함 URL (핵심!)
      const searchUrl = `https://m.place.naver.com/restaurant/list?query=${encodeURIComponent(keyword)}&x=${x}&y=${y}&level=top&entry=pll`;
      console.log(`📍 [플레이스] URL: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });

      // SPA 로딩 대기
      console.log('⏳ [플레이스] SPA 렌더링 대기 중... (최대 15초)');
      
      let selectorFound = false;
      let retryCount = 0;
      const maxRetries = 15;

      while (!selectorFound && retryCount < maxRetries) {
        try {
          await page.waitForSelector('a[href*="/restaurant/"], a[href*="/place/"]', { timeout: 1000 });
          selectorFound = true;
          console.log(`✅ [플레이스] 결과 셀렉터 발견! (${retryCount + 1}초 후)`);
        } catch (e) {
          retryCount++;
        }
      }

      if (!selectorFound) {
        await page.close();
        return {
          success: false,
          rank: -1,
          error: '플레이스 리스트가 로딩되지 않았습니다.',
          keyword,
          placeUrl,
        };
      }

      await page.waitForTimeout(2000);

      const maxRank = 300;
      let rank = -1;
      let foundPlace = null;
      let scrollCount = 0;
      const maxScrolls = 100;  // 50 → 100으로 증가
      const seen = new Set();
      let allPlaces = [];
      let lastCount = 0;
      let noNewDataCount = 0;

      console.log(`📜 [플레이스] 스크롤 시작 - 최대 ${maxRank}위까지 검색...`);

      while (rank === -1 && scrollCount < maxScrolls && allPlaces.length < maxRank) {
        // "더보기" 버튼 텍스트로 찾아서 클릭
        const moreButtonClicked = await page.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll('button, a, div, span'));
          const btn = candidates.find(el => {
            if (!el || !el.textContent) return false;
            const txt = el.textContent.trim();
            return txt === '더보기' || txt === '더 보기';
          });
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });
        
        if (moreButtonClicked) {
          console.log('🔘 [플레이스] "더보기" 버튼 클릭!');
          await page.waitForTimeout(2000);
        }

        const items = await page.evaluate(() => {
          const arr = [];
          
          // li.UEzoS 가 업체 아이템
          const listItems = document.querySelectorAll('li.UEzoS');
          
          listItems.forEach((li, index) => {
            try {
              // li 안의 모든 링크에서 place ID 찾기
              const links = li.querySelectorAll('a');
              let placeId = null;
              let href = '';
              
              for (const link of links) {
                let linkHref = link.getAttribute('href') || '';
                
                // HTML 엔티티 변환 (&amp; -> &)
                linkHref = linkHref.replace(/&amp;/g, '&');
                
                // 1. 인코딩된 상태에서 직접 찾기 (%2F = /)
                let m = linkHref.match(/%2Frestaurant%2F(\d+)/i) || 
                        linkHref.match(/%2Fplace%2F(\d+)/i);
                if (m) {
                  placeId = m[1];
                  href = linkHref;
                  break;
                }
                
                // 2. URL 디코딩 후 찾기
                try {
                  let decodedHref = decodeURIComponent(linkHref);
                  if (decodedHref.includes('%2F')) {
                    decodedHref = decodeURIComponent(decodedHref);
                  }
                  
                  m = decodedHref.match(/\/restaurant\/(\d+)/i) || 
                      decodedHref.match(/\/place\/(\d+)/i);
                  if (m) {
                    placeId = m[1];
                    href = decodedHref;
                    break;
                  }
                } catch (e) {}
                
                // 3. 직접 패턴
                m = linkHref.match(/\/restaurant\/(\d+)/i) || 
                    linkHref.match(/\/place\/(\d+)/i);
                if (m) {
                  placeId = m[1];
                  href = linkHref;
                  break;
                }
              }
              
              if (!placeId) return;
              
              // 업체명 추출
              let name = '';
              const nameEl = li.querySelector('.TYaxT, span');
              if (nameEl) {
                name = nameEl.textContent.trim();
              }
              if (!name) {
                name = li.textContent.trim().split('\n')[0].substring(0, 30);
              }
              
              arr.push({ placeId, name, href });
            } catch (e) {}
          });
          
          // 중복 제거
          const unique = [];
          const seenIds = new Set();
          arr.forEach(item => {
            if (!seenIds.has(item.placeId)) {
              seenIds.add(item.placeId);
              unique.push(item);
            }
          });
          
          return unique;
        });

        for (const it of items) {
          const key = it.placeId;
          if (!seen.has(key)) {
            seen.add(key);
            const currentRank = allPlaces.length + 1;
            it.rank = currentRank;
            allPlaces.push(it);

            if (it.placeId === targetPlaceId && rank === -1) {
              rank = currentRank;
              foundPlace = it;
              console.log(`✅ [플레이스] 타겟 발견! 순위: ${rank}위 - ${it.name}`);
            }
          }
        }

        // 진행 상황 로깅
        if (scrollCount % 5 === 0) {
          console.log(`📜 [플레이스] ${scrollCount + 1}번 스크롤 - 현재 ${allPlaces.length}개 로드됨`);
        }

        // 새 데이터 없으면 카운트 증가
        if (allPlaces.length === lastCount) {
          noNewDataCount++;
          if (noNewDataCount >= 10) {  // 5 → 10으로 증가
            console.log(`⚠️ [플레이스] 10회 연속 새 데이터 없음 - 종료`);
            break;
          }
        } else {
          noNewDataCount = 0;
          lastCount = allPlaces.length;
        }

        if (rank !== -1 || allPlaces.length >= maxRank) break;

        // 스크롤 - 여러 방법 시도
        await page.evaluate(() => {
          // 방법 1: 스크롤 가능한 컨테이너 찾기
          const scrollContainers = [
            document.querySelector('[class*="search_list"]'),
            document.querySelector('[class*="place_list"]'),
            document.querySelector('[class*="scroll"]'),
            document.querySelector('[class*="result"]'),
            document.querySelector('main'),
            document.querySelector('[role="main"]'),
            document.body
          ].filter(el => el);
          
          // 각 컨테이너 스크롤 시도
          for (const container of scrollContainers) {
            if (container.scrollHeight > container.clientHeight) {
              container.scrollTop = container.scrollHeight;
            }
          }
          
          // window도 스크롤
          window.scrollTo(0, document.body.scrollHeight);
          
          // 마지막 li 아이템으로 스크롤
          const lastItem = document.querySelector('li.UEzoS:last-child');
          if (lastItem) {
            lastItem.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        });
        await page.waitForTimeout(2000);  // 1500 → 2000으로 증가
        scrollCount++;
      }

      console.log(`\n📊 [플레이스] 최종: ${allPlaces.length}개 검색됨`);

      await page.close();

      const duration = Date.now() - startTime;
      console.log(`⏱️ [플레이스] 소요시간: ${duration}ms\n`);

      return {
        success: true,
        rank,
        keyword,
        placeUrl,
        method: '모바일 플레이스 스크롤',
        totalResults: allPlaces.length,
        foundPlace,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [플레이스] 크롤링 실패:', error);
      return {
        success: false,
        rank: -1,
        error: error.message,
        keyword,
        placeUrl,
      };
    }
  }

  // ============================================================
  // 블로그 순위 체크 (Puppeteer 기반!)
  // ============================================================
  async checkBlogRank(keyword, blogUrl) {
    console.log(`\n🔍 [블로그] 순위 체크 시작: "${keyword}"`);
    const startTime = Date.now();

    const targetBlog = extractBlogInfo(blogUrl);
    console.log(`🎯 [블로그] 찾는 블로그: ${targetBlog ? `${targetBlog.blogId}/${targetBlog.logNo}` : 'N/A'}, URL: ${blogUrl}`);

    if (!targetBlog) {
      return {
        success: false,
        rank: -1,
        error: 'URL에서 Blog ID/LogNo를 추출할 수 없습니다. (형식: blog.naver.com/아이디/글번호)',
        keyword,
        blogUrl,
      };
    }

    try {
      const browser = await this.init();
      const page = await browser.newPage();
      await this.setupPage(page, false); // PC 모드

      const maxRank = 300;
      let rank = -1;
      let foundPost = null;
      let totalChecked = 0;
      const seen = new Set();

      // 네이버 블로그 검색은 &start=1,11,21,31... (10개씩)
      for (let start = 1; start <= maxRank && rank === -1; start += 10) {
        const searchUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}&start=${start}`;
        
        if (start === 1 || start % 50 === 1) {
          console.log(`📜 [블로그] ${start}~${start + 9}위 검색 중...`);
        }

        try {
          await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });
          
          // 블로그 검색 결과 로딩 대기
          await page.waitForSelector('.api_txt_lines, .title_link, .sh_blog_title, a[href*="blog.naver.com"]', { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(500);

          // 블로그 결과 파싱 (Puppeteer로 렌더링된 DOM에서!)
          const items = await page.evaluate(() => {
            const results = [];
            
            // 여러 셀렉터로 블로그 링크 찾기
            const links = document.querySelectorAll(
              '.api_txt_lines.total_tit, ' +
              '.title_link, ' +
              '.sh_blog_title, ' +
              'a.title_link, ' +
              '.total_wrap a[href*="blog.naver.com"]'
            );

            links.forEach(el => {
              const href = el.getAttribute('href') || '';
              const title = el.textContent?.trim() || '';
              
              // blog.naver.com/blogId/logNo 패턴 또는 PostView.naver 패턴 찾기
              let blogId = null;
              let logNo = null;
              
              let m = href.match(/blog\.naver\.com\/([^\/\?]+)\/(\d+)/i);
              if (m) {
                blogId = m[1];
                logNo = m[2];
              } else {
                m = href.match(/blogId=([^&]+).*logNo=(\d+)/i);
                if (m) {
                  blogId = m[1];
                  logNo = m[2];
                }
              }
              
              if (blogId && logNo) {
                results.push({ blogId, logNo, title, href });
              }
            });

            return results;
          });

          // 순위 계산
          for (const item of items) {
            const key = `${item.blogId}/${item.logNo}`;
            if (!seen.has(key)) {
              seen.add(key);
              totalChecked++;
              
              if (item.blogId === targetBlog.blogId && item.logNo === targetBlog.logNo) {
                rank = totalChecked;
                foundPost = { ...item, rank };
                console.log(`✅ [블로그] 타겟 발견! 순위: ${rank}위 - ${item.title.slice(0, 30)}...`);
                break;
              }
            }
          }

        } catch (e) {
          console.log(`⚠️ [블로그] ${start}위 페이지 로드 실패:`, e.message);
        }

        // 요청 간 딜레이
        await page.waitForTimeout(500);
      }

      await page.close();

      const duration = Date.now() - startTime;
      console.log(`📊 [블로그] 최종: ${totalChecked}개 검색됨`);
      console.log(`⏱️ [블로그] 소요시간: ${duration}ms\n`);

      return {
        success: true,
        rank,
        keyword,
        blogUrl,
        method: 'Puppeteer 파싱',
        totalResults: totalChecked,
        foundPost,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [블로그] 크롤링 실패:', error);
      return {
        success: false,
        rank: -1,
        error: error.message,
        keyword,
        blogUrl,
      };
    }
  }

  // ============================================================
  // 쇼핑 순위 체크 (Puppeteer 기반!)
  // ============================================================
  async checkShoppingRank(keyword, productUrl) {
    console.log(`\n🔍 [쇼핑] 순위 체크 시작: "${keyword}"`);
    const startTime = Date.now();

    const targetProductId = extractProductId(productUrl);
    console.log(`🎯 [쇼핑] 찾는 상품 ID: ${targetProductId}, URL: ${productUrl}`);

    if (!targetProductId) {
      return {
        success: false,
        rank: -1,
        error: 'URL에서 Product ID를 추출할 수 없습니다.',
        keyword,
        productUrl,
      };
    }

    try {
      const browser = await this.init();
      const page = await browser.newPage();
      await this.setupPage(page, false); // PC 모드

      const maxRank = 300;
      let rank = -1;
      let foundProduct = null;
      let totalChecked = 0;
      const seen = new Set();

      // 네이버 쇼핑 - 스크롤 방식 (한 페이지에 많은 결과)
      const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&sort=rel`;
      console.log(`📜 [쇼핑] URL: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // 쇼핑 결과 로딩 대기
      await page.waitForSelector('[class*="product_item"], [class*="item__"], a[href*="product"]', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);

      let scrollCount = 0;
      const maxScrolls = 30;

      while (rank === -1 && scrollCount < maxScrolls && totalChecked < maxRank) {
        // 현재 페이지에서 상품 파싱
        const items = await page.evaluate(() => {
          const results = [];
          
          // 다양한 셀렉터로 상품 찾기
          const productElements = document.querySelectorAll(
            '[class*="product_item"], ' +
            '[class*="item__inner"], ' +
            '[class*="basicList_item"], ' +
            '.product_info_area a, ' +
            'a[href*="shopping.naver.com/product"], ' +
            'a[href*="smartstore.naver.com"][href*="products"]'
          );

          productElements.forEach(el => {
            // 상품 링크 찾기
            const linkEl = el.tagName === 'A' ? el : el.querySelector('a[href*="product"]');
            if (!linkEl) return;
            
            const href = linkEl.getAttribute('href') || '';
            
            // 상품 ID 추출
            let productId = null;
            let m = href.match(/products?\/(\d+)/i);
            if (m) {
              productId = m[1];
            } else {
              m = href.match(/nvMid=(\d+)/i);
              if (m) productId = m[1];
            }
            
            if (!productId) return;
            
            // 상품명 찾기
            const titleEl = el.querySelector('[class*="title"], [class*="name"], .product_title, strong') || el;
            const title = titleEl.textContent?.trim().slice(0, 100) || '';
            
            results.push({ productId, title, href });
          });

          return results;
        });

        // 순위 계산
        for (const item of items) {
          if (!seen.has(item.productId)) {
            seen.add(item.productId);
            totalChecked++;
            
            if (item.productId === targetProductId) {
              rank = totalChecked;
              foundProduct = { ...item, rank };
              console.log(`✅ [쇼핑] 타겟 발견! 순위: ${rank}위 - ${item.title.slice(0, 30)}...`);
              break;
            }
          }
        }

        if (rank !== -1 || totalChecked >= maxRank) break;

        // 스크롤
        if (scrollCount % 5 === 0) {
          console.log(`📜 [쇼핑] ${scrollCount + 1}번 스크롤 - 현재 ${totalChecked}개 로드됨`);
        }

        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await page.waitForTimeout(1500);
        scrollCount++;
      }

      await page.close();

      const duration = Date.now() - startTime;
      console.log(`📊 [쇼핑] 최종: ${totalChecked}개 검색됨`);
      console.log(`⏱️ [쇼핑] 소요시간: ${duration}ms\n`);

      return {
        success: true,
        rank,
        keyword,
        productUrl,
        method: 'Puppeteer 스크롤',
        totalResults: totalChecked,
        foundProduct,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [쇼핑] 크롤링 실패:', error);
      return {
        success: false,
        rank: -1,
        error: error.message,
        keyword,
        productUrl,
      };
    }
  }

  // ============================================================
  // 대표 키워드 추출 (플레이스 페이지에서)
  // ============================================================
  async getMainKeyword(placeUrl) {
    console.log(`\n🔍 [대표키워드] 추출 시작: ${placeUrl}`);
    const startTime = Date.now();

    try {
      const browser = await this.init();
      const page = await browser.newPage();
      await this.setupPage(page, true);

      await page.goto(placeUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(2000);

      const keywords = await page.evaluate(() => {
        const result = [];
        const keywordEls = document.querySelectorAll('[class*="keyword"], [class*="tag"], .chip, .tag');
        keywordEls.forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length > 1 && text.length < 20) {
            result.push(text);
          }
        });
        return result;
      });

      await page.close();

      const duration = Date.now() - startTime;
      console.log(`📊 [대표키워드] 발견: ${keywords.length}개`);
      console.log(`⏱️ [대표키워드] 소요시간: ${duration}ms\n`);

      return {
        success: true,
        keywords,
        placeUrl,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ [대표키워드] 추출 실패:', error);
      return {
        success: false,
        keywords: [],
        error: error.message,
        placeUrl,
      };
    }
  }
}

// 싱글톤 인스턴스
const crawler = new NaverCrawler();

module.exports = crawler;

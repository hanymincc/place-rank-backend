const puppeteer = require('puppeteer');

class Crawler {
  constructor() {
    this.browser = null;
  }

  async init() {
    if (!this.browser) {
      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ],
      };

      // Railway/배포 환경에서 시스템 Chromium 사용
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }

      this.browser = await puppeteer.launch(launchOptions);
    }
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // 플레이스 순위 체크
  async checkPlaceRank(keyword, placeUrl) {
    try {
      const browser = await this.init();
      const page = await browser.newPage();
      
      // User agent 설정
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15');
      
      // 네이버 플레이스 검색
      const searchUrl = `https://m.place.naver.com/restaurant/list?query=${encodeURIComponent(keyword)}`;
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // 잠시 대기
      await page.waitForTimeout(2000);

      // 순위 데이터 추출
      const results = await page.evaluate(() => {
        const items = document.querySelectorAll('li[class*="item"]');
        return Array.from(items).map((item, index) => {
          const titleEl = item.querySelector('span[class*="place"]');
          const linkEl = item.querySelector('a');
          
          return {
            rank: index + 1,
            title: titleEl ? titleEl.textContent.trim() : '',
            link: linkEl ? linkEl.href : '',
          };
        });
      });

      await page.close();

      // placeUrl에서 ID 추출
      const placeIdMatch = placeUrl.match(/place\/(\d+)/);
      const placeId = placeIdMatch ? placeIdMatch[1] : null;

      console.log(`=== 순위 체크 결과 ===`);
      console.log(`키워드: ${keyword}`);
      console.log(`검색 결과 수: ${results.length}`);
      console.log(`검색된 업체들:`, results.map(r => `${r.rank}. ${r.title} (ID: ${r.link.match(/place\/(\d+)/)?.[1] || 'N/A'})`));
      console.log(`찾는 플레이스 ID: ${placeId}`);

      // 순위 찾기
      let rank = -1;
      let foundPlace = null;

      if (placeId) {
        const found = results.find(item => item.link.includes(placeId));
        if (found) {
          rank = found.rank;
          foundPlace = found;
        }
      }

      return {
        success: true,
        rank,
        keyword,
        placeUrl,
        totalResults: results.length,
        foundPlace,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('플레이스 순위 체크 오류:', error);
      throw error;
    }
  }

  // 블로그 순위 체크
  async checkBlogRank(keyword, blogUrl) {
    try {
      const browser = await this.init();
      const page = await browser.newPage();
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // 네이버 블로그 검색
      const searchUrl = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}`;
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await page.waitForTimeout(2000);

      // 블로그 결과 추출
      const results = await page.evaluate(() => {
        const items = document.querySelectorAll('.api_subject_bx');
        return Array.from(items).map((item, index) => {
          const titleEl = item.querySelector('.api_txt_lines');
          const linkEl = item.querySelector('a.api_txt_lines');
          
          return {
            rank: index + 1,
            title: titleEl ? titleEl.textContent.trim() : '',
            link: linkEl ? linkEl.href : '',
          };
        });
      });

      await page.close();

      // 순위 찾기
      let rank = -1;
      let foundBlog = null;

      const found = results.find(item => item.link.includes(blogUrl));
      if (found) {
        rank = found.rank;
        foundBlog = found;
      }

      return {
        success: true,
        rank,
        keyword,
        blogUrl,
        totalResults: results.length,
        foundBlog,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('블로그 순위 체크 오류:', error);
      throw error;
    }
  }

  // 쇼핑 순위 체크
  async checkShoppingRank(keyword, productUrl) {
    try {
      const browser = await this.init();
      const page = await browser.newPage();
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // 네이버 쇼핑 검색
      const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`;
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await page.waitForTimeout(2000);

      // 쇼핑 결과 추출
      const results = await page.evaluate(() => {
        const items = document.querySelectorAll('.product_item__MDtDF');
        return Array.from(items).map((item, index) => {
          const titleEl = item.querySelector('.product_title__Mmw2K');
          const linkEl = item.querySelector('a');
          
          return {
            rank: index + 1,
            title: titleEl ? titleEl.textContent.trim() : '',
            link: linkEl ? linkEl.href : '',
          };
        });
      });

      await page.close();

      // 순위 찾기
      let rank = -1;
      let foundProduct = null;

      const productIdMatch = productUrl.match(/products\/(\d+)/);
      const productId = productIdMatch ? productIdMatch[1] : null;

      if (productId) {
        const found = results.find(item => item.link.includes(productId));
        if (found) {
          rank = found.rank;
          foundProduct = found;
        }
      }

      return {
        success: true,
        rank,
        keyword,
        productUrl,
        totalResults: results.length,
        foundProduct,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('쇼핑 순위 체크 오류:', error);
      throw error;
    }
  }

  // 플레이스 대표 키워드 추출
  async getMainKeyword(placeUrl) {
    try {
      const browser = await this.init();
      const page = await browser.newPage();
      
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15');
      
      await page.goto(placeUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await page.waitForTimeout(2000);

      // 대표 키워드 추출
      const keywords = await page.evaluate(() => {
        const title = document.querySelector('span[class*="Fc1rA"]');
        const category = document.querySelector('span[class*="DJJvD"]');
        
        return {
          placeName: title ? title.textContent.trim() : '',
          category: category ? category.textContent.trim() : '',
        };
      });

      await page.close();

      return {
        success: true,
        placeUrl,
        keywords,
        checkedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('대표 키워드 추출 오류:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
const crawler = new Crawler();

// 프로세스 종료 시 브라우저 닫기
process.on('SIGINT', async () => {
  await crawler.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await crawler.close();
  process.exit(0);
});

module.exports = crawler;

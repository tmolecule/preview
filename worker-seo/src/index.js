import { handleArticle, handleIndex } from './learn.js';
import { handleSitemap, handleRobots } from './sitemap.js';
import { renderNotFound } from './template.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/' || path === '') {
      return handleIndex(env, url.origin);
    }

    if (path === '/sitemap.xml') {
      return handleSitemap(env, url.origin);
    }

    if (path === '/robots.txt') {
      return handleRobots(url.origin);
    }

    const slug = path.slice(1);
    if (/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) {
      const article = await handleArticle(slug, env, url.origin);
      if (article) return article;
    }

    return new Response(renderNotFound(env, url.origin), {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60'
      }
    });
  }
};

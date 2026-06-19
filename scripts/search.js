/**
 * 墨水主题 — 客户端全文搜索
 *
 * 构建时 Gridea Pro 自动生成 /api/search.json，
 * 前端首次打开懒加载 JSON → 内存实时模糊匹配。
 *
 * 纯原生 JS，零依赖。
 */
;(function () {
  'use strict';

  // -- 常量 ----------------------------------------------------------------
  var SEARCH_JSON_URL = '/api/search.json';
  var DEBOUNCE_MS = 150;
  var EXCERPT_RADIUS = 40;
  var ACTIVE_CLASS = 'is-active';
  var WEIGHT_TITLE = 10;
  var WEIGHT_TAG = 5;
  var WEIGHT_CONTENT = 1;

  // -- 状态 ----------------------------------------------------------------
  var posts = null;
  var isLoading = false;
  var debounceId = null;
  var activeIdx = -1;

  // -- DOM 引用 ------------------------------------------------------------
  var overlay, modal, input, results, closeBtn;

  function resolveDOM() {
    if (overlay) return;
    overlay = document.getElementById('searchOverlay');
    modal = overlay ? overlay.querySelector('.search-modal') : null;
    input = document.getElementById('searchInput');
    results = document.getElementById('searchResults');
    closeBtn = document.getElementById('searchClose');
  }

  // -- 数据加载（懒加载，缓存于内存） -------------------------------------
  function ensureData(cb) {
    if (posts !== null) return cb();
    if (isLoading) return;
    isLoading = true;
    showMsg('加载中…');

    var xhr = new XMLHttpRequest();
    xhr.open('GET', SEARCH_JSON_URL, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      isLoading = false;
      try { posts = xhr.status === 200 ? JSON.parse(xhr.responseText) : []; }
      catch (_) { posts = []; }
      cb();
    };
    xhr.send();
  }

  // -- 打开 / 关闭 --------------------------------------------------------
  function openSearch() {
    resolveDOM();
    if (!overlay) return;
    overlay.style.display = '';
    overlay.setAttribute('aria-hidden', 'false');
    input.value = '';
    activeIdx = -1;
    document.body.style.overflow = 'hidden';
    showRecommendations();
    requestAnimationFrame(function () { input.focus(); });
  }

  function showRecommendations() {
    if (!results || !posts || !posts.length) {
      if (results) results.innerHTML = '';
      return;
    }
    var recent = randomPick(posts, 8);
    var html = '';
    for (var i = 0; i < recent.length; i++) {
      var p = recent[i];
      var tagsHTML = '';
      if (p.tags && p.tags.length) {
        tagsHTML = '<div class="sr-tags">';
        for (var t = 0; t < p.tags.length; t++) {
          tagsHTML += '<span class="sr-tag">' + esc(p.tags[t]) + '</span>';
        }
        tagsHTML += '</div>';
      }
      html += '<a class="sr-item" href="' + esc(p.link) + '"'
        + ' role="option" aria-selected="false">'
        + '<div class="sr-item-title">' + esc(p.title) + ' <span class="sr-arrow">→</span></div>'
        + '<div class="sr-item-excerpt">' + esc((p.content || '').substring(0, 50) + ((p.content || '').length > 50 ? '…' : '')) + '</div>'
        + '<div class="sr-item-meta">' + tagsHTML + '<span class="sr-item-date">' + esc(p.date) + '</span></div>'
        + '</a>';
    }
    results.innerHTML = html;
  }

  function closeSearch() {
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // -- 消息 ----------------------------------------------------------------
  function showMsg(text) {
    if (results) results.innerHTML = '<div class="sr-empty">' + esc(text) + '</div>';
  }

  // -- 搜索算法 ------------------------------------------------------------
  function scorePost(post, query) {
    var lq = query.toLowerCase();
    var lt = (post.title || '').toLowerCase();
    var lc = (post.content || '').toLowerCase();
    var tags = post.tags || [];
    var ti = lt.indexOf(lq);
    var ci = lc.indexOf(lq);

    var tagHit = false;
    for (var k = 0; k < tags.length; k++) {
      if (tags[k].toLowerCase().indexOf(lq) !== -1) { tagHit = true; break; }
    }

    if (ti === -1 && ci === -1 && !tagHit) return null;

    var score = 0;
    if (ti !== -1) score += WEIGHT_TITLE * (1 + 1 / (1 + ti));
    if (tagHit) score += WEIGHT_TAG;
    if (ci !== -1) score += WEIGHT_CONTENT * (1 + 1 / (1 + ci));

    var titleHL = ti !== -1
      ? hlMatch(post.title, ti, query.length)
      : esc(post.title);

    var excerptHL;
    if (ci !== -1) {
      excerptHL = buildExcerpt(post.content, ci, query.length);
    } else {
      var plain = (post.content || '').substring(0, EXCERPT_RADIUS * 2);
      excerptHL = esc(plain) + (plain.length < (post.content || '').length ? '…' : '');
    }

    return { score: score, titleHL: titleHL, excerptHL: excerptHL };
  }

  function executeSearch(query) {
    if (!results) return;
    var q = (query || '').trim();
    if (!q) { showRecommendations(); activeIdx = -1; return; }

    var matched = [];
    for (var i = 0; i < posts.length; i++) {
      var hit = scorePost(posts[i], q);
      if (hit) {
        matched.push({
          link: posts[i].link, date: posts[i].date || '',
          tags: posts[i].tags || [],
          titleHL: hit.titleHL, excerptHL: hit.excerptHL, score: hit.score
        });
      }
    }

    matched.sort(function (a, b) { return b.score - a.score; });

    if (!matched.length) { showMsg('未找到相关文章'); activeIdx = -1; return; }

    var html = '';
    for (var j = 0; j < matched.length; j++) {
      var m = matched[j];
      var tagsHTML = '';
      if (m.tags && m.tags.length) {
        var lq = q.toLowerCase();
        tagsHTML = '<div class="sr-tags">';
        for (var t = 0; t < m.tags.length; t++) {
          var isHit = m.tags[t].toLowerCase() === lq;
          tagsHTML += '<span class="sr-tag' + (isHit ? ' sr-tag--hit' : '') + '">' + esc(m.tags[t]) + '</span>';
        }
        tagsHTML += '</div>';
      }
      html += '<a class="sr-item" href="' + esc(m.link) + '"'
        + ' role="option" aria-selected="false">'
        + '<div class="sr-item-title">' + m.titleHL + ' <span class="sr-arrow">→</span></div>'
        + '<div class="sr-item-excerpt">' + m.excerptHL + '</div>'
        + '<div class="sr-item-meta">' + tagsHTML + '<span class="sr-item-date">' + esc(m.date) + '</span></div>'
        + '</a>';
    }
    results.innerHTML = html;
    activeIdx = -1;
  }

  // -- 高亮 & 摘要 ----------------------------------------------------------
  function hlMatch(text, idx, len) {
    return esc(text.substring(0, idx))
      + '<mark>' + esc(text.substring(idx, idx + len)) + '</mark>'
      + esc(text.substring(idx + len));
  }

  function buildExcerpt(content, idx, len) {
    var start = Math.max(0, idx - EXCERPT_RADIUS);
    var end = Math.min(content.length, idx + len + EXCERPT_RADIUS);
    var prefix = start > 0 ? '…' : '';
    var suffix = end < content.length ? '…' : '';
    return prefix
      + esc(content.substring(start, idx))
      + '<mark>' + esc(content.substring(idx, idx + len)) + '</mark>'
      + esc(content.substring(idx + len, end))
      + suffix;
  }

  // -- 键盘导航 ------------------------------------------------------------
  function resultItems() {
    return results ? results.querySelectorAll('.sr-item') : [];
  }

  function setActive(newIdx) {
    var items = resultItems();
    if (!items.length) return;

    if (activeIdx >= 0 && activeIdx < items.length) {
      items[activeIdx].classList.remove(ACTIVE_CLASS);
      items[activeIdx].setAttribute('aria-selected', 'false');
    }

    if (newIdx < 0) newIdx = items.length - 1;
    if (newIdx >= items.length) newIdx = 0;
    activeIdx = newIdx;

    items[activeIdx].classList.add(ACTIVE_CLASS);
    items[activeIdx].setAttribute('aria-selected', 'true');
    items[activeIdx].scrollIntoView({ block: 'nearest' });
  }

  function openActive() {
    var items = resultItems();
    if (activeIdx >= 0 && activeIdx < items.length) {
      window.location.href = items[activeIdx].getAttribute('href');
    }
  }

  // -- Focus Trap ----------------------------------------------------------
  function trapFocus(e) {
    if (!modal || e.key !== 'Tab') return;
    var els = modal.querySelectorAll(
      'input, button, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (!els.length) return;
    var first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  // -- 工具函数 ------------------------------------------------------------
  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function randomPick(arr, n) {
    var pool = arr.slice();
    var count = Math.min(n, pool.length);
    for (var i = pool.length - 1; i > 0 && pool.length - i <= count; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(pool.length - count);
  }

  function debounce(fn, ms) {
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(debounceId);
      debounceId = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  // -- 事件绑定 ------------------------------------------------------------
  function bindEvents() {
    resolveDOM();
    if (!overlay || !input || !results || !closeBtn) return;

    var btns = document.querySelectorAll('.search-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (e) {
        e.preventDefault();
        ensureData(openSearch);
      });
    }

    // ⌘K / Ctrl+K
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        ensureData(openSearch);
      }
    });

    closeBtn.addEventListener('click', closeSearch);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeSearch();
    });

    var debouncedSearch = debounce(function () {
      executeSearch(input.value);
    }, DEBOUNCE_MS);
    input.addEventListener('input', debouncedSearch);

    overlay.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'Escape': e.preventDefault(); closeSearch(); break;
        case 'ArrowDown': e.preventDefault(); setActive(activeIdx + 1); break;
        case 'ArrowUp': e.preventDefault(); setActive(activeIdx - 1); break;
        case 'Enter':
          if (activeIdx >= 0) { e.preventDefault(); openActive(); }
          break;
      }
      trapFocus(e);
    });
  }

  // -- 初始化 --------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }
})();

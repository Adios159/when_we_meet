// 브레인스토밍 게시판: 글 작성/목록, 댓글 작성/목록.
// 익명이라 작성자 정보는 다루지 않고, 글/댓글 내용과 시간만 표시한다.

window.Board = (function () {
  function timeAgo(isoLike) {
    // SQLite CURRENT_TIMESTAMP는 "YYYY-MM-DD HH:MM:SS" (UTC) 형식
    const date = new Date(isoLike.replace(" ", "T") + "Z");
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return "방금 전";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
    return `${Math.floor(diffSec / 86400)}일 전`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function init({ roomId }) {
    const $ = (sel) => document.querySelector(sel);
    const postInput = $("#post-input");
    const postCharCount = $("#post-char-count");
    const postStatus = $("#post-status");
    const postList = $("#post-list");

    postInput.addEventListener("input", () => {
      postCharCount.textContent = `${postInput.value.length}/100`;
    });

    $("#btn-post-submit").addEventListener("click", async () => {
      const content = postInput.value.trim();
      if (!content) return;
      try {
        await window.Api.createPost(roomId, content);
        postInput.value = "";
        postCharCount.textContent = "0/100";
        postStatus.innerHTML = "";
        await loadPosts();
      } catch (e) {
        postStatus.innerHTML = `<div class="status-msg err">${e.message}</div>`;
      }
    });

    function renderComment(comment) {
      const el = document.createElement("div");
      el.className = "comment-item";
      el.innerHTML = `
        <span class="comment-content">${escapeHtml(comment.content)}</span>
        <span class="comment-time">${timeAgo(comment.created_at)}</span>
      `;
      return el;
    }

    async function loadComments(postId, commentListEl) {
      commentListEl.innerHTML = '<p class="hint">댓글 불러오는 중...</p>';
      try {
        const comments = await window.Api.getComments(roomId, postId);
        commentListEl.innerHTML = "";
        if (comments.length === 0) {
          commentListEl.innerHTML = '<p class="hint">아직 댓글이 없어요.</p>';
        } else {
          comments.forEach((c) => commentListEl.appendChild(renderComment(c)));
        }
      } catch (e) {
        commentListEl.innerHTML = `<div class="status-msg err">${e.message}</div>`;
      }
    }

    function renderPost(post) {
      const card = document.createElement("div");
      card.className = "card post-card";

      card.innerHTML = `
        <div class="post-content">${escapeHtml(post.content)}</div>
        <div class="post-meta">
          <span class="post-time">${timeAgo(post.created_at)}</span>
          <button class="ghost small btn-toggle-comments">댓글 ${post.comment_count}개</button>
        </div>
        <div class="comments hidden">
          <div class="comment-list"></div>
          <div class="compose comment-compose">
            <textarea maxlength="100" rows="2" placeholder="댓글을 100자 이내로 적어주세요..."></textarea>
            <div class="compose-footer">
              <span class="char-count">0/100</span>
              <button class="secondary small btn-comment-submit">댓글 달기</button>
            </div>
          </div>
          <div class="comment-status"></div>
        </div>
      `;

      const toggleBtn = card.querySelector(".btn-toggle-comments");
      const commentsWrap = card.querySelector(".comments");
      const commentListEl = card.querySelector(".comment-list");
      const commentInput = card.querySelector(".comment-compose textarea");
      const commentCharCount = card.querySelector(".comment-compose .char-count");
      const commentSubmitBtn = card.querySelector(".btn-comment-submit");
      const commentStatusEl = card.querySelector(".comment-status");

      let loaded = false;
      toggleBtn.addEventListener("click", () => {
        commentsWrap.classList.toggle("hidden");
        if (!commentsWrap.classList.contains("hidden") && !loaded) {
          loaded = true;
          loadComments(post.id, commentListEl);
        }
      });

      commentInput.addEventListener("input", () => {
        commentCharCount.textContent = `${commentInput.value.length}/100`;
      });

      commentSubmitBtn.addEventListener("click", async () => {
        const content = commentInput.value.trim();
        if (!content) return;
        try {
          await window.Api.createComment(roomId, post.id, content);
          commentInput.value = "";
          commentCharCount.textContent = "0/100";
          commentStatusEl.innerHTML = "";
          toggleBtn.textContent = `댓글 ${
            commentListEl.querySelectorAll(".comment-item").length + 1
          }개`;
          await loadComments(post.id, commentListEl);
        } catch (e) {
          commentStatusEl.innerHTML = `<div class="status-msg err">${e.message}</div>`;
        }
      });

      return card;
    }

    async function loadPosts() {
      postList.innerHTML = '<p class="hint">글 불러오는 중...</p>';
      try {
        const posts = await window.Api.getPosts(roomId);
        postList.innerHTML = "";
        if (posts.length === 0) {
          postList.innerHTML =
            '<p class="hint">아직 아무도 글을 남기지 않았어요. 첫 아이디어를 남겨보세요!</p>';
          return;
        }
        posts.forEach((p) => postList.appendChild(renderPost(p)));
      } catch (e) {
        postList.innerHTML = `<div class="status-msg err">${e.message}</div>`;
      }
    }

    return { loadPosts };
  }

  return { init };
})();

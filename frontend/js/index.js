(function () {
  const $ = (sel) => document.querySelector(sel);

  function showStatus(el, msg, type) {
    el.innerHTML = `<div class="status-msg ${type}">${msg}</div>`;
  }

  $("#btn-create").addEventListener("click", async () => {
    const nameInput = $("#room-name");
    const status = $("#create-status");
    const name = nameInput.value.trim();
    if (!name) {
      showStatus(status, "방 이름을 입력해주세요.", "err");
      return;
    }
    try {
      const room = await window.Api.createRoom(name);
      const url = `${location.origin}${location.pathname.replace(
        "index.html",
        ""
      )}room.html?room=${room.room_id}`;
      showStatus(
        status,
        `방이 만들어졌어요! 아래 링크를 조원들에게 공유하세요.<br/>
         <div class="share-box" style="margin-top:8px;">
           <code>${url}</code>
           <button class="ghost" id="copy-link">복사</button>
         </div>`,
        "ok"
      );
      document.getElementById("copy-link").addEventListener("click", () => {
        navigator.clipboard.writeText(url);
      });
      setTimeout(() => {
        location.href = url;
      }, 600);
    } catch (e) {
      showStatus(status, e.message, "err");
    }
  });

  $("#btn-join").addEventListener("click", async () => {
    const idInput = $("#room-id");
    const status = $("#join-status");
    const roomId = idInput.value.trim();
    if (!roomId) {
      showStatus(status, "방 코드를 입력해주세요.", "err");
      return;
    }
    try {
      await window.Api.getRoom(roomId);
      location.href = `room.html?room=${roomId}`;
    } catch (e) {
      showStatus(status, "해당 방을 찾을 수 없어요: " + e.message, "err");
    }
  });
})();

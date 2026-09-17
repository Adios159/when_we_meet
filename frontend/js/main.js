(function () {
  const $ = (sel) => document.querySelector(sel);
  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");

  if (!roomId) {
    document.body.innerHTML =
      '<div class="wrap"><div class="card">방 코드가 없어요. <a href="index.html">처음으로 돌아가기</a></div></div>';
    return;
  }

  const LS_KEY = `ftf_submission_${roomId}`;
  const LS_SLOTS_KEY = `ftf_slots_${roomId}`;

  let grid = null;
  let aligner = null;
  const board = window.Board.init({ roomId });

  // ---------- 탭 ----------
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-panel")
        .forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "overlap") loadOverlap();
      if (btn.dataset.tab === "board") board.loadPosts();
    });
  });

  // ---------- 방 정보 ----------
  async function initRoom() {
    try {
      const room = await window.Api.getRoom(roomId);
      $("#room-title").textContent = `🕐 ${room.name}`;
      $("#share-link").textContent = location.href;
      $("#copy-link").addEventListener("click", () => {
        navigator.clipboard.writeText(location.href);
      });
    } catch (e) {
      $("#room-title").textContent = "방을 찾을 수 없어요";
      return;
    }

    const savedSlots = JSON.parse(localStorage.getItem(LS_SLOTS_KEY) || "null");
    grid = window.TimeGrid($("#grid-container"), savedSlots);

    // 이미 제출했던 사람이 다시 들어온 경우, 미리보기 단계를 바로 보여줌
    if (savedSlots) {
      showPreview("저장해둔 내 시간표예요. 바뀐 게 있으면 고치고 다시 제출하세요.");
    }
  }

  function showPreview(hintMsg) {
    $("#step-preview").classList.remove("hidden");
    if (hintMsg) $("#preview-hint").textContent = hintMsg;
    $("#step-preview").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- 그리드 제출 ----------
  $("#btn-clear").addEventListener("click", () => grid && grid.clear());

  $("#btn-skip-shot").addEventListener("click", () => {
    showPreview(
      "칸을 클릭해서 바쁜 시간을 표시하세요. 클릭할 때마다 바쁨(회색) ↔ 비어있음(기본)이 전환돼요."
    );
  });

  $("#btn-redo-shot").addEventListener("click", () => {
    $("#step-upload").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#btn-submit").addEventListener("click", async () => {
    const statusEl = $("#submit-status");
    if (!grid) return;
    const slots = grid.getSlots();
    const existingId = localStorage.getItem(LS_KEY);
    try {
      const res = await window.Api.submitSlots(roomId, slots, existingId);
      localStorage.setItem(LS_KEY, res.submission_id);
      localStorage.setItem(LS_SLOTS_KEY, JSON.stringify(slots));
      statusEl.innerHTML = `<div class="status-msg ok">저장됐어요. 다른 사람이 제출한 시간표와 겹쳐서 계산할게요.</div>`;
    } catch (e) {
      statusEl.innerHTML = `<div class="status-msg err">${e.message}</div>`;
    }
  });

  // ---------- 스크린샷 정렬/자동 감지 ----------
  const shotInput = $("#shot-input");
  const shotWrap = $("#shot-wrap");
  const shotControls = $("#shot-controls");
  const shotStatus = $("#shot-status");

  function shotStatusMsg(msg, type) {
    shotStatus.innerHTML = `<div class="status-msg ${type}">${msg}</div>`;
  }

  shotInput.addEventListener("change", async () => {
    const file = shotInput.files[0];
    if (!file) return;
    shotWrap.classList.remove("hidden");
    shotWrap.innerHTML = "";
    aligner = window.ScreenshotAligner(shotWrap);
    await aligner.loadImage(file);
    shotControls.hidden = false;
    shotStatusMsg(
      "파란 점을 드래그해서 월요일 09:00 왼쪽 위 ~ 금요일 18:00 오른쪽 아래(월~금 전체)에 맞춰주세요.",
      "info"
    );
  });

  $("#btn-sample-bg").addEventListener("click", () => {
    if (!aligner) return;
    shotStatusMsg("이미지에서 완전히 빈 시간대(수업 없는 칸)를 클릭하세요.", "info");
    aligner.startBgSampling((color) => {
      shotStatusMsg(
        `배경색 지정 완료 (rgb ${Math.round(color.r)}, ${Math.round(
          color.g
        )}, ${Math.round(color.b)}). 이제 "미리보기 만들기"를 눌러주세요.`,
        "ok"
      );
    });
  });

  $("#btn-detect").addEventListener("click", async () => {
    if (!aligner) return;
    if (!aligner.hasImage()) {
      shotStatusMsg("먼저 스크린샷을 업로드해주세요.", "err");
      return;
    }
    let colorResult;
    try {
      colorResult = aligner.detectByColor(28);
    } catch (e) {
      shotStatusMsg(e.message, "err");
      return;
    }

    let finalResult = colorResult;
    const useOcr = $("#use-ocr").checked;

    if (useOcr && window.Tesseract) {
      shotStatusMsg("글자 인식 중... (인터넷 연결이 필요해요, 시간이 좀 걸려요)", "info");
      try {
        const ocrResult = new Array(colorResult.length).fill(false);
        for (let d = 0; d < window.DAY_COUNT; d++) {
          for (let s = 0; s < window.SLOT_COUNT; s++) {
            const dataUrl = aligner.cropCellDataUrl(d, s);
            const {
              data: { text },
            } = await window.Tesseract.recognize(dataUrl, "eng");
            ocrResult[window.cellIndex(d, s)] = text.trim().length >= 2;
          }
        }
        finalResult = colorResult.map((v, i) => v || ocrResult[i]);
      } catch (e) {
        shotStatusMsg(
          "글자 인식에 실패해서 색상 분석 결과만 사용할게요. (" + e.message + ")",
          "info"
        );
      }
    } else if (useOcr && !window.Tesseract) {
      shotStatusMsg(
        "Tesseract 라이브러리를 불러오지 못했어요(인터넷 연결 확인). 색상 분석 결과만 사용할게요.",
        "info"
      );
    }

    grid.setAll(finalResult);
    shotStatusMsg(
      "미리보기를 만들었어요. 아래로 내려가서 실제 시간표와 맞는지 확인해주세요.",
      "ok"
    );
    showPreview(
      "스크린샷을 분석한 결과예요. 실제 시간표와 다른 칸이 있으면 클릭해서 고친 뒤 제출하세요."
    );
  });

  // ---------- 겹치는 시간 ----------
  async function loadOverlap() {
    const listEl = $("#overlap-list");
    const subEl = $("#overlap-count-sub");
    const summaryEl = $("#all-free-summary");
    listEl.innerHTML = "겹치는 시간을 계산하는 중...";
    try {
      const data = await window.Api.getOverlap(roomId);
      subEl.textContent = `총 ${data.submission_count}명이 시간표를 제출했어요.`;

      if (data.submission_count === 0) {
        listEl.innerHTML =
          '<p class="hint">아직 아무도 시간표를 제출하지 않았어요.</p>';
        summaryEl.innerHTML = "";
        return;
      }

      listEl.innerHTML = "";
      const nSlots = data.slot_labels.length;
      const nDays = data.day_labels.length;

      const table = document.createElement("div");
      table.className = "grid-table heat-grid";
      table.style.setProperty("--day-count", nDays);

      table.appendChild(document.createElement("div")); // 왼쪽 위 빈 칸
      for (const d of data.day_labels) {
        const head = document.createElement("div");
        head.className = "grid-day-head";
        head.textContent = d;
        table.appendChild(head);
      }

      for (let s = 0; s < nSlots; s++) {
        const timeLabel = document.createElement("div");
        timeLabel.className = "grid-cell-time";
        timeLabel.textContent = s % 2 === 0 ? data.slot_labels[s] : "";
        table.appendChild(timeLabel);

        for (let d = 0; d < nDays; d++) {
          const i = window.cellIndex(d, s);
          const pct = data.free_counts[i] / data.submission_count;
          const cell = document.createElement("div");
          cell.className =
            "grid-cell heat-cell" + (data.all_free[i] ? " all-free" : "");
          if (!data.all_free[i]) {
            cell.style.background = `rgba(34,197,139,${(pct * 0.75).toFixed(2)})`;
          }
          cell.title = `${data.day_labels[d]} ${data.slot_labels[s]}: ${data.free_counts[i]}/${data.submission_count}명 가능`;
          table.appendChild(cell);
        }
      }
      listEl.appendChild(table);

      const freeCells = [];
      for (let d = 0; d < nDays; d++) {
        for (let s = 0; s < nSlots; s++) {
          const i = window.cellIndex(d, s);
          if (data.all_free[i]) {
            freeCells.push(`${data.day_labels[d]} ${data.slot_labels[s]}`);
          }
        }
      }
      if (freeCells.length === 0) {
        summaryEl.innerHTML =
          '<span class="none">전원이 동시에 비는 30분 구간이 아직 없어요.</span>';
      } else {
        summaryEl.innerHTML =
          "<b>전원이 비는 시간대:</b><br/>" +
          freeCells.map((l) => `<span class="chip">${l}</span>`).join("");
      }
    } catch (e) {
      listEl.innerHTML = `<div class="status-msg err">${e.message}</div>`;
    }
  }

  $("#btn-refresh-overlap").addEventListener("click", loadOverlap);

  // ---------- 이스터에그 ----------
  (function initEasterEgg() {
    const title = document.querySelector(".top h1");
    if (!title) return;
    const SECRET_PLAYLIST_URL =
      "https://open.spotify.com/playlist/7BUPUXzdKqbImyIap3OfVo?si=SbCV-mNgRY69iid2ax06Ng";
    let clickCount = 0;
    let resetTimer = null;
    title.addEventListener("click", () => {
      clickCount += 1;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        clickCount = 0;
      }, 2000);
      if (clickCount >= 5) {
        clickCount = 0;
        window.open(SECRET_PLAYLIST_URL, "_blank", "noopener");
      }
    });
  })();

  initRoom();
})();

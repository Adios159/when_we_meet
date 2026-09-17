// 시간표 스크린샷을 업로드하고, 사용자가 두 개의 파란 점을 드래그해서
// "월요일 09:00 윗선(왼쪽 위) ~ 금요일 18:00 아랫선(오른쪽 아래)" 전체 영역에 맞추면
// 그 사이를 요일(DAY_COUNT) x 시간대(SLOT_COUNT) 칸으로 나눠 색상을 분석해서
// busy/free를 자동으로 채워주는 도구.
//
// 원리:
//  1) 캔버스에 이미지를 그린다.
//  2) 사용자가 두 개의 핸들(좌상단, 우하단)을 드래그해서
//     "월~금 전체 + 09:00~18:00 전체" 영역을 감싸게 맞춘다.
//  3) "빈 칸 배경색 지정" 버튼으로 빈 시간대 색을 한 번 클릭해서 알려준다.
//  4) 자동 감지를 누르면 영역을 가로 DAY_COUNT등분 x 세로 SLOT_COUNT등분해서
//     각 칸 중앙부의 평균 색을 구하고, 배경색과 색 차이가 threshold 이상이면
//     "수업 있음(busy)"으로 판정한다.
//  5) (선택) tesseract.js로 각 칸에 글자가 있는지도 같이 확인해서 보조 신호로 사용.

window.ScreenshotAligner = function (wrapEl) {
  const canvas = document.createElement("canvas");
  wrapEl.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const handleTL = document.createElement("div");
  handleTL.className = "handle";
  const handleBR = document.createElement("div");
  handleBR.className = "handle";
  wrapEl.appendChild(handleTL);
  wrapEl.appendChild(handleBR);

  let img = null;
  let rect = null; // {x1,y1,x2,y2} in NATURAL canvas pixel coords
  let bgColor = null; // {r,g,b}

  function naturalToDisplay(pt) {
    const r = canvas.getBoundingClientRect();
    const scaleX = r.width / canvas.width;
    const scaleY = r.height / canvas.height;
    return {
      x: pt.x * scaleX,
      y: pt.y * scaleY,
    };
  }

  function displayToNatural(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return {
      x: (clientX - r.left) * scaleX,
      y: (clientY - r.top) * scaleY,
    };
  }

  function positionHandles() {
    if (!rect) return;
    const wrapRect = wrapEl.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const offsetX = canvasRect.left - wrapRect.left;
    const offsetY = canvasRect.top - wrapRect.top;

    const tl = naturalToDisplay({ x: rect.x1, y: rect.y1 });
    const br = naturalToDisplay({ x: rect.x2, y: rect.y2 });

    handleTL.style.left = `${offsetX + tl.x}px`;
    handleTL.style.top = `${offsetY + tl.y}px`;
    handleBR.style.left = `${offsetX + br.x}px`;
    handleBR.style.top = `${offsetY + br.y}px`;
  }

  function redraw() {
    if (!img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (rect) {
      ctx.strokeStyle = "#5b8def";
      ctx.lineWidth = Math.max(2, canvas.width * 0.003);
      ctx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);

      const nSlots = window.SLOT_COUNT;
      const nDays = window.DAY_COUNT;

      // 시간대 분할선 (가로줄)
      const h = (rect.y2 - rect.y1) / nSlots;
      ctx.strokeStyle = "rgba(91,141,239,0.5)";
      ctx.lineWidth = 1;
      for (let i = 1; i < nSlots; i++) {
        const y = rect.y1 + h * i;
        ctx.beginPath();
        ctx.moveTo(rect.x1, y);
        ctx.lineTo(rect.x2, y);
        ctx.stroke();
      }

      // 요일 분할선 (세로줄)
      const w = (rect.x2 - rect.x1) / nDays;
      ctx.strokeStyle = "rgba(91,141,239,0.8)";
      ctx.lineWidth = Math.max(1, canvas.width * 0.0015);
      for (let i = 1; i < nDays; i++) {
        const x = rect.x1 + w * i;
        ctx.beginPath();
        ctx.moveTo(x, rect.y1);
        ctx.lineTo(x, rect.y2);
        ctx.stroke();
      }
    }
    positionHandles();
  }

  function makeDraggable(handle, onMove) {
    let dragging = false;
    handle.addEventListener("pointerdown", (e) => {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const p = displayToNatural(e.clientX, e.clientY);
      onMove(p);
      redraw();
    });
    handle.addEventListener("pointerup", (e) => {
      dragging = false;
      handle.releasePointerCapture(e.pointerId);
    });
  }

  makeDraggable(handleTL, (p) => {
    rect.x1 = Math.max(0, Math.min(p.x, rect.x2 - 10));
    rect.y1 = Math.max(0, Math.min(p.y, rect.y2 - 10));
  });
  makeDraggable(handleBR, (p) => {
    rect.x2 = Math.min(canvas.width, Math.max(p.x, rect.x1 + 10));
    rect.y2 = Math.min(canvas.height, Math.max(p.y, rect.y1 + 10));
  });

  let samplingBg = false;
  canvas.addEventListener("click", (e) => {
    if (!samplingBg) return;
    const p = displayToNatural(e.clientX, e.clientY);
    const px = ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
    bgColor = { r: px[0], g: px[1], b: px[2] };
    samplingBg = false;
    canvas.style.cursor = "default";
    if (typeof onBgSampled === "function") onBgSampled(bgColor);
  });

  let onBgSampled = null;

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          img = image;
          // 너무 큰 이미지는 다운스케일 (분석 성능 + 메모리)
          const maxDim = 1400;
          const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);

          // 기본 사각형: 이미지 가운데에 월~금 전체 폭 x 09~18시 전체 높이로 넓게 잡음
          const w = canvas.width * 0.85;
          const h = canvas.height * 0.7;
          const x1 = (canvas.width - w) / 2;
          const y1 = canvas.height * 0.15;
          rect = { x1, y1, x2: x1 + w, y2: y1 + h };
          bgColor = null;
          redraw();
          resolve();
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function startBgSampling(cb) {
    samplingBg = true;
    onBgSampled = cb;
    canvas.style.cursor = "crosshair";
  }

  function colorDistance(a, b) {
    return Math.sqrt(
      (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
    );
  }

  // (day, slot) 칸의 x/y 범위 (natural 좌표)
  function cellBounds(day, slot) {
    const nSlots = window.SLOT_COUNT;
    const nDays = window.DAY_COUNT;
    const w = (rect.x2 - rect.x1) / nDays;
    const h = (rect.y2 - rect.y1) / nSlots;
    return {
      x1: rect.x1 + w * day,
      x2: rect.x1 + w * (day + 1),
      y1: rect.y1 + h * slot,
      y2: rect.y1 + h * (slot + 1),
    };
  }

  // 칸 하나의 평균 색상 (테두리 노이즈 피하려고 안쪽 80%(가로)/70%(세로) 영역만 샘플링)
  function averageColorOfCell(day, slot) {
    const b = cellBounds(day, slot);
    const cw = b.x2 - b.x1;
    const ch = b.y2 - b.y1;
    const cx1 = b.x1 + cw * 0.1;
    const cx2 = b.x2 - cw * 0.1;
    const cy1 = b.y1 + ch * 0.15;
    const cy2 = b.y2 - ch * 0.15;

    const x = Math.max(0, Math.round(cx1));
    const y = Math.max(0, Math.round(cy1));
    const w = Math.max(1, Math.round(cx2 - cx1));
    const hh = Math.max(1, Math.round(cy2 - cy1));

    const data = ctx.getImageData(x, y, w, hh).data;
    let r = 0, g = 0, b2 = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b2 += data[i + 2];
      count++;
    }
    return { r: r / count, g: g / count, b: b2 / count };
  }

  // threshold: 색 차이가 이 값보다 크면 "수업 있음"으로 판정
  // 반환값: 길이 DAY_COUNT*SLOT_COUNT 배열 (인덱스 규칙은 window.cellIndex와 동일)
  function detectByColor(threshold = 28) {
    if (!rect) throw new Error("영역이 아직 설정되지 않았어요.");
    if (!bgColor) throw new Error("먼저 빈 시간대 배경색을 지정해주세요.");
    const nSlots = window.SLOT_COUNT;
    const nDays = window.DAY_COUNT;
    const result = new Array(nDays * nSlots).fill(false);
    for (let d = 0; d < nDays; d++) {
      for (let s = 0; s < nSlots; s++) {
        const avg = averageColorOfCell(d, s);
        const dist = colorDistance(avg, bgColor);
        result[window.cellIndex(d, s)] = dist > threshold;
      }
    }
    return result;
  }

  // 각 칸을 잘라서 dataURL로 반환 (tesseract 등 외부 OCR에 넘기기용)
  function cropCellDataUrl(day, slot) {
    const b = cellBounds(day, slot);
    const w = b.x2 - b.x1;
    const hh = b.y2 - b.y1;

    const tmp = document.createElement("canvas");
    tmp.width = Math.max(1, Math.round(w));
    tmp.height = Math.max(1, Math.round(hh));
    const tctx = tmp.getContext("2d");
    tctx.drawImage(
      canvas,
      b.x1, b.y1, w, hh,
      0, 0, tmp.width, tmp.height
    );
    return tmp.toDataURL();
  }

  return {
    loadImage,
    startBgSampling,
    detectByColor,
    cropCellDataUrl,
    hasImage: () => !!img,
    hasBg: () => !!bgColor,
  };
};

const fs = require('fs');
const path = require('path');

const outputDir = __dirname;

const palette = {
  paper: '#f5f5f5',
  paper2: '#ececec',
  white: '#ffffff',
  ink: '#2d3142',
  muted: '#4f5d75',
  soft: '#7a8399',
  accent: '#eb6c36',
  link: '#2e5aa8',
  sage: '#4f735f',
  mustard: '#a97814',
  purple: '#7454a5',
};

const escapeText = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

function defs() {
  return `
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${palette.muted}"/></marker>
      <marker id="arrow-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${palette.link}"/></marker>
      <marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${palette.accent}"/></marker>
      <marker id="arrow-open" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polyline points="0 0, 8 3, 0 6" fill="none" stroke="${palette.muted}" stroke-width="1.2"/></marker>
      <marker id="uml-generalization" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto"><polygon points="0 0, 12 5, 0 10" fill="${palette.paper}" stroke="${palette.muted}" stroke-width="1"/></marker>
      <marker id="uml-composition" markerWidth="12" markerHeight="10" refX="1" refY="5" orient="auto-start-reverse"><polygon points="1 5, 6 1, 11 5, 6 9" fill="${palette.ink}" stroke="${palette.ink}" stroke-width="1"/></marker>
    </defs>`;
}

function commonCss(width) {
  return `
    *,*::before,*::after{box-sizing:border-box}html,body{margin:0}body{padding:32px;color:${palette.ink};background:${palette.paper};font-family:'Geist',system-ui,sans-serif}
    header{max-width:1120px;margin-bottom:24px}.eyebrow{margin:0 0 8px;color:${palette.muted};font:500 8px 'Geist Mono',monospace;letter-spacing:.16em;text-transform:uppercase}
    h1{margin:0 0 12px;font:650 40px/1.08 'Segoe UI',Arial,sans-serif;letter-spacing:-.025em}.subtitle{margin:0;color:${palette.muted};font-size:16px;line-height:1.5}
    .diagram-shell{height:calc(100vh - 180px);min-height:520px;display:flex;flex-direction:column;background:${palette.paper};border:1px solid rgba(45,49,66,.16);border-radius:8px;overflow:hidden}
    .diagram-toolbar{flex:0 0 48px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 12px;background:${palette.white};border-bottom:1px solid rgba(45,49,66,.12)}
    .interaction-hint{color:${palette.muted};font:500 12px 'Geist Mono',monospace;white-space:nowrap}.toolbar-actions{display:flex;align-items:center;gap:8px}.tool-button{min-width:40px;height:32px;padding:0 12px;color:${palette.ink};background:${palette.paper};border:1px solid rgba(45,49,66,.24);border-radius:6px;font:600 12px 'Geist',sans-serif;cursor:pointer}.tool-button:hover{color:${palette.link};border-color:${palette.link}}.tool-button:focus-visible,.canvas:focus-visible{outline:2px solid ${palette.link};outline-offset:-2px}.zoom-level{min-width:58px;color:${palette.muted};font:600 12px 'Geist Mono',monospace;text-align:center}.noscript-note{margin:0;padding:8px 12px;color:${palette.muted};background:rgba(169,120,20,.09);border-bottom:1px solid rgba(169,120,20,.32);font:500 12px 'Geist',sans-serif}
    .canvas{position:relative;flex:1 1 auto;min-height:0;width:100%;overflow:auto;cursor:grab;overscroll-behavior:contain;touch-action:none;scrollbar-color:${palette.soft} ${palette.paper2}}.canvas.is-dragging{cursor:grabbing;user-select:none}svg{display:block;width:${width}px;height:auto;background:${palette.paper}}
    .zone{fill:rgba(45,49,66,.025);stroke:rgba(45,49,66,.16);stroke-width:1}.zone-title{fill:${palette.soft};font:500 8px 'Geist Mono',monospace;letter-spacing:.14em}
    .node{fill:${palette.white};stroke:${palette.ink};stroke-width:1}.actor{fill:rgba(46,90,168,.08);stroke:rgba(46,90,168,.62);stroke-width:1}.external{fill:rgba(45,49,66,.03);stroke:rgba(45,49,66,.34);stroke-width:1;stroke-dasharray:4 4}
    .focal{fill:rgba(235,108,54,.08);stroke:${palette.accent};stroke-width:1.2}.store{fill:rgba(45,49,66,.05);stroke:${palette.muted};stroke-width:1}.state{fill:${palette.white};stroke:${palette.muted};stroke-width:1}
    .rule{fill:rgba(169,120,20,.08);stroke:rgba(169,120,20,.56);stroke-width:1}.usecase{fill:rgba(116,84,165,.07);stroke:rgba(116,84,165,.52);stroke-width:1}.quality{fill:rgba(79,115,95,.08);stroke:rgba(79,115,95,.52);stroke-width:1}
    .title{fill:${palette.ink};font:600 20px 'Geist',sans-serif}.name{fill:${palette.ink};font:600 16px 'Geist',sans-serif}.name-sm{fill:${palette.ink};font:600 12px 'Geist',sans-serif}.body{fill:${palette.muted};font:400 12px 'Geist',sans-serif}.mono{fill:${palette.muted};font:400 12px 'Geist Mono',monospace}.mono-xs{fill:${palette.muted};font:400 8px 'Geist Mono',monospace}.tag{fill:${palette.soft};font:500 8px 'Geist Mono',monospace;letter-spacing:.12em}
    .edge{fill:none;stroke:${palette.muted};stroke-width:1.2}.edge-link{fill:none;stroke:${palette.link};stroke-width:1.2}.edge-event{fill:none;stroke:${palette.muted};stroke-width:1.1;stroke-dasharray:5 4}.edge-accent{fill:none;stroke:${palette.accent};stroke-width:1.4}.lifeline{stroke:rgba(45,49,66,.22);stroke-width:1;stroke-dasharray:4 4}
    .uml-association{fill:none;stroke:${palette.muted};stroke-width:1}.uml-dependency{fill:none;stroke:${palette.purple};stroke-width:1.1;stroke-dasharray:6 4}.uml-symbol{fill:${palette.white};stroke:${palette.ink};stroke-width:1.25}.uml-usecase{fill:rgba(116,84,165,.07);stroke:${palette.purple};stroke-width:1.15}.uml-usecase-optional{fill:rgba(169,120,20,.08);stroke:${palette.mustard};stroke-width:1.15}.actor-line{fill:none;stroke:${palette.link};stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.activity-action{fill:${palette.white};stroke:${palette.ink};stroke-width:1.1}.activity-decision{fill:rgba(169,120,20,.09);stroke:${palette.mustard};stroke-width:1.2}.activity-flow{fill:none;stroke:${palette.muted};stroke-width:1.25}.activation{fill:rgba(46,90,168,.12);stroke:${palette.link};stroke-width:1}.bce-boundary{fill:${palette.white};stroke:${palette.link};stroke-width:1.4}.bce-control{fill:rgba(235,108,54,.08);stroke:${palette.accent};stroke-width:1.4}.bce-entity{fill:rgba(45,49,66,.05);stroke:${palette.muted};stroke-width:1.4}.model-header{fill:rgba(46,90,168,.06)}.erd-header{fill:rgba(46,90,168,.1)}.erd-row{fill:rgba(45,49,66,.025)}.key-badge{fill:${palette.paper2};stroke:rgba(45,49,66,.2);stroke-width:.8}.db-fill{fill:rgba(45,49,66,.04);stroke:${palette.muted};stroke-width:1.1}.service-component{fill:${palette.white};stroke:${palette.link};stroke-width:1.1}.deploy-node{fill:${palette.white};stroke:${palette.muted};stroke-width:1.1}.event-envelope{fill:rgba(116,84,165,.07);stroke:${palette.purple};stroke-width:1.1}.protocol-label{fill:${palette.paper};stroke:rgba(45,49,66,.16);stroke-width:.8}
    .footer-rule{stroke:rgba(45,49,66,.16);stroke-width:.8}.footer{fill:${palette.soft};font:400 8px 'Geist Mono',monospace;letter-spacing:.06em}
    @media(max-width:760px){body{padding:16px}h1{font-size:32px}.subtitle{font-size:14px}.diagram-shell{height:calc(100vh - 160px);min-height:420px}.interaction-hint{display:none}.tool-button{padding:0 9px}}
    @media print{body{padding:0}.diagram-shell{height:auto;border:0;overflow:visible}.diagram-toolbar,.noscript-note{display:none}.canvas{overflow:visible}svg{width:100%!important;height:auto!important}}`;
}

function htmlPage({ slug, title, subtitle, width, height, body, source, legend = 'Nét liền: gọi trực tiếp · Nét đứt: sự kiện/không đồng bộ' }) {
  const footerY = height - 28;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeText(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=Geist:wght@400;500;600&amp;family=Geist+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet">
  <style>${commonCss(width)}</style>
</head>
<body>
  <header>
    <p class="eyebrow">Online Bus Ticket Platform · Diagram con</p>
    <h1>${escapeText(title)}</h1>
    <p class="subtitle">${escapeText(subtitle)}</p>
  </header>
  <div class="diagram-shell">
    <div class="diagram-toolbar" role="group" aria-label="Điều khiển sơ đồ">
      <span class="interaction-hint">Lăn chuột: zoom · giữ chuột trái và kéo: di chuyển · phím F: vừa chiều rộng</span>
      <div class="toolbar-actions">
        <button class="tool-button" id="zoom-out" type="button" aria-label="Thu nhỏ">−</button>
        <output class="zoom-level" id="zoom-level" aria-live="polite">100%</output>
        <button class="tool-button" id="zoom-in" type="button" aria-label="Phóng to">+</button>
        <button class="tool-button" id="fit-width" type="button">Vừa rộng</button>
        <button class="tool-button" id="reset-view" type="button">100%</button>
      </div>
    </div>
    <noscript><p class="noscript-note">JavaScript đang tắt: sơ đồ vẫn hiển thị nhưng zoom bằng con lăn và kéo canvas sẽ không hoạt động.</p></noscript>
    <div class="canvas" id="diagram-viewport" tabindex="0" aria-label="Sơ đồ tương tác. Lăn chuột để phóng to hoặc thu nhỏ; giữ chuột trái và kéo để di chuyển.">
    <svg id="diagram-canvas" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${slug}-title ${slug}-desc">
      <title id="${slug}-title">${escapeText(title)}</title>
      <desc id="${slug}-desc">${escapeText(subtitle)}</desc>
      ${defs()}
      <rect width="${width}" height="${height}" fill="${palette.paper}"/>
      ${body}
      <line class="footer-rule" x1="32" y1="${height - 52}" x2="${width - 32}" y2="${height - 52}"/>
      <text class="footer" x="32" y="${footerY}">${escapeText(legend)}</text>
      <text class="footer" x="${width - 32}" y="${footerY}" text-anchor="end">Nguồn: ${escapeText(source)}</text>
    </svg>
    </div>
  </div>
  <script>
    (() => {
      const viewport = document.getElementById('diagram-viewport');
      const svg = document.getElementById('diagram-canvas');
      const zoomLevel = document.getElementById('zoom-level');
      const title = svg.querySelector(':scope > title');
      const desc = svg.querySelector(':scope > desc');
      if (title) {
        svg.setAttribute('aria-label', title.textContent || 'Diagram');
        svg.removeAttribute('aria-labelledby');
        if (desc?.id) svg.setAttribute('aria-describedby', desc.id);
        title.remove();
      }

      const baseWidth = ${width};
      const baseHeight = ${height};
      const minimumZoom = .18;
      const maximumZoom = 2.5;
      let zoom = 1;
      const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

      function updateCanvasSize() {
        svg.style.width = Math.round(baseWidth * zoom) + 'px';
        svg.style.height = Math.round(baseHeight * zoom) + 'px';
        zoomLevel.value = Math.round(zoom * 100) + '%';
        zoomLevel.textContent = zoomLevel.value;
      }

      function setZoom(nextZoom, clientX, clientY) {
        const previousZoom = zoom;
        const rect = viewport.getBoundingClientRect();
        const anchorX = clientX ?? rect.left + viewport.clientWidth / 2;
        const anchorY = clientY ?? rect.top + viewport.clientHeight / 2;
        const offsetX = anchorX - rect.left;
        const offsetY = anchorY - rect.top;
        const contentX = (viewport.scrollLeft + offsetX) / previousZoom;
        const contentY = (viewport.scrollTop + offsetY) / previousZoom;
        zoom = clamp(nextZoom, minimumZoom, maximumZoom);
        updateCanvasSize();
        viewport.scrollLeft = contentX * zoom - offsetX;
        viewport.scrollTop = contentY * zoom - offsetY;
      }

      function zoomBy(factor, clientX, clientY) { setZoom(zoom * factor, clientX, clientY); }
      function fitWidth() {
        const fittedZoom = (viewport.clientWidth - 24) / baseWidth;
        zoom = clamp(fittedZoom, minimumZoom, maximumZoom);
        updateCanvasSize();
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
      }
      function resetView() {
        zoom = 1;
        updateCanvasSize();
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
      }

      viewport.addEventListener('wheel', (event) => {
        event.preventDefault();
        zoomBy(clamp(Math.exp(-event.deltaY * .0015), .75, 1.25), event.clientX, event.clientY);
      }, { passive: false });
      viewport.addEventListener('dblclick', (event) => {
        event.preventDefault();
        zoomBy(1.25, event.clientX, event.clientY);
      });

      let dragPointerId = null;
      let dragStartX = 0;
      let dragStartY = 0;
      let dragScrollLeft = 0;
      let dragScrollTop = 0;
      viewport.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        dragPointerId = event.pointerId;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        dragScrollLeft = viewport.scrollLeft;
        dragScrollTop = viewport.scrollTop;
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add('is-dragging');
        event.preventDefault();
      });
      viewport.addEventListener('pointermove', (event) => {
        if (event.pointerId !== dragPointerId) return;
        viewport.scrollLeft = dragScrollLeft - (event.clientX - dragStartX);
        viewport.scrollTop = dragScrollTop - (event.clientY - dragStartY);
      });
      function stopDragging(event) {
        if (event.pointerId !== dragPointerId) return;
        if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
        dragPointerId = null;
        viewport.classList.remove('is-dragging');
      }
      viewport.addEventListener('pointerup', stopDragging);
      viewport.addEventListener('pointercancel', stopDragging);

      document.getElementById('zoom-in').addEventListener('click', () => zoomBy(1.2));
      document.getElementById('zoom-out').addEventListener('click', () => zoomBy(1 / 1.2));
      document.getElementById('fit-width').addEventListener('click', fitWidth);
      document.getElementById('reset-view').addEventListener('click', resetView);
      viewport.addEventListener('keydown', (event) => {
        const panStep = 96;
        if (event.key === '+' || event.key === '=') zoomBy(1.2);
        else if (event.key === '-') zoomBy(1 / 1.2);
        else if (event.key === '0') resetView();
        else if (event.key.toLowerCase() === 'f') fitWidth();
        else if (event.key === 'ArrowLeft') viewport.scrollLeft -= panStep;
        else if (event.key === 'ArrowRight') viewport.scrollLeft += panStep;
        else if (event.key === 'ArrowUp') viewport.scrollTop -= panStep;
        else if (event.key === 'ArrowDown') viewport.scrollTop += panStep;
        else return;
        event.preventDefault();
      });
      window.addEventListener('resize', () => { if (zoom < .7) fitWidth(); });
      updateCanvasSize();
      requestAnimationFrame(fitWidth);
    })();
  </script>
</body>
</html>`;
}

function wrapSvgText(value, maxWidth, charWidth, maxLines = 2) {
  const text = String(value);
  const estimatedWidth = text.length * charWidth;
  if (estimatedWidth <= maxWidth) return [{ text, textLength: null }];
  if (estimatedWidth <= maxWidth * 1.12) return [{ text, textLength: maxWidth }];

  const delimiter = text.includes(' · ') ? ' · ' : ' ';
  const chunks = text.split(delimiter).filter(Boolean);
  const lines = [];
  let current = '';
  chunks.forEach((chunk) => {
    const candidate = current ? `${current}${delimiter}${chunk}` : chunk;
    if (current && candidate.length * charWidth > maxWidth) {
      lines.push(current);
      current = chunk;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);

  while (lines.length > maxLines) {
    lines[maxLines - 1] = `${lines[maxLines - 1]}${delimiter}${lines[maxLines]}`;
    lines.splice(maxLines, 1);
  }
  return lines.map((line) => ({
    text: line,
    textLength: line.length * charWidth > maxWidth ? maxWidth : null,
  }));
}

function svgTextLine(x, y, line, className, anchor = 'middle') {
  const fit = line.textLength ? ` textLength="${line.textLength}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text class="${className}" x="${x}" y="${y}" text-anchor="${anchor}"${fit}>${escapeText(line.text)}</text>`;
}

function node(x, y, width, height, title, sub = '', kind = 'node', tag = '') {
  const maxTextWidth = width - 40;
  const titleLines = wrapSvgText(title, maxTextWidth, 8.8, 2);
  const subLines = sub ? wrapSvgText(sub, maxTextWidth, 7.3, 2) : [];
  const contentTop = y + (tag ? 28 : 8);
  const contentBottom = y + height - 8;
  const availableHeight = contentBottom - contentTop;

  let nameClass = 'name';
  let nameFont = 16;
  let nameLineHeight = 20;
  let monoClass = 'mono';
  let monoFont = 12;
  let monoLineHeight = 18;
  let sectionGap = subLines.length ? 6 : 0;
  const blockHeight = () => nameFont + (titleLines.length - 1) * nameLineHeight
    + sectionGap + (subLines.length ? monoFont + (subLines.length - 1) * monoLineHeight : 0);

  if (blockHeight() > availableHeight) {
    nameClass = 'name-sm';
    nameFont = 12;
    nameLineHeight = 16;
    monoLineHeight = 16;
    sectionGap = subLines.length ? 4 : 0;
  }
  if (blockHeight() > availableHeight) {
    monoClass = 'mono-xs';
    monoFont = 8;
    monoLineHeight = 12;
  }

  const startY = contentTop + Math.max(0, (availableHeight - blockHeight()) / 2);
  const titleBaseline = startY + nameFont;
  const titleSvg = titleLines.map((line, index) => svgTextLine(x + width / 2, titleBaseline + index * nameLineHeight, line, nameClass)).join('\n');
  const subBaseline = titleBaseline + (titleLines.length - 1) * nameLineHeight + sectionGap + monoFont;
  const subSvg = subLines.map((line, index) => svgTextLine(x + width / 2, subBaseline + index * monoLineHeight, line, monoClass)).join('\n');
  return `
    <g data-node="true">
      <rect class="${kind}" x="${x}" y="${y}" width="${width}" height="${height}" rx="8"/>
      ${tag ? `<text class="tag" x="${x + 16}" y="${y + 20}">${escapeText(tag)}</text>` : ''}
      ${titleSvg}
      ${subSvg}
    </g>`;
}

function textLines(x, y, lines, className = 'body', gap = 24, anchor = 'start') {
  return lines.map((line, index) => `<text class="${className}" x="${x}" y="${y + index * gap}" text-anchor="${anchor}">${escapeText(line)}</text>`).join('\n');
}

function straight(x1, y1, x2, y2, className = 'edge', marker = 'arrow') {
  if (x1 !== x2 && y1 !== y2) throw new Error(`Straight connector is diagonal: ${x1},${y1} -> ${x2},${y2}`);
  return `<line class="${className}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#${marker})"/>`;
}

function elbow(x1, y1, x2, y2, className = 'edge', marker = 'arrow') {
  if (x1 === x2 || y1 === y2) return straight(x1, y1, x2, y2, className, marker);
  const mid = Math.round((x1 + x2) / 2 / 4) * 4;
  const sx = x2 > x1 ? 1 : -1;
  const sy = y2 > y1 ? 1 : -1;
  return `<path class="${className}" d="M${x1} ${y1} H${mid - sx * 8} Q${mid} ${y1} ${mid} ${y1 + sy * 8} V${y2 - sy * 8} Q${mid} ${y2} ${mid + sx * 8} ${y2} H${x2}" marker-end="url(#${marker})"/>`;
}

function routedElbow(x1, y1, x2, y2, bendX, className = 'edge', marker = 'arrow') {
  if (y1 === y2) return straight(x1, y1, x2, y2, className, marker);
  const sx = x2 > x1 ? 1 : -1;
  const sy = y2 > y1 ? 1 : -1;
  return `<path class="${className}" d="M${x1} ${y1} H${bendX - sx * 8} Q${bendX} ${y1} ${bendX} ${y1 + sy * 8} V${y2 - sy * 8} Q${bendX} ${y2} ${bendX + sx * 8} ${y2} H${x2}" marker-end="url(#${marker})"/>`;
}

function orthogonalNoArrow(x1, y1, x2, y2, className = 'edge') {
  if (x1 === x2 || y1 === y2) {
    return `<line class="${className}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  const mid = Math.round((x1 + x2) / 2 / 4) * 4;
  const sx = x2 > x1 ? 1 : -1;
  const sy = y2 > y1 ? 1 : -1;
  return `<path class="${className}" d="M${x1} ${y1} H${mid - sx * 8} Q${mid} ${y1} ${mid} ${y1 + sy * 8} V${y2 - sy * 8} Q${mid} ${y2} ${mid + sx * 8} ${y2} H${x2}"/>`;
}

function zone(x, y, width, height, title) {
  return `<rect class="zone" x="${x}" y="${y}" width="${width}" height="${height}" rx="8"/><rect x="${x + 16}" y="${y + 4}" width="${Math.max(144, title.length * 8)}" height="16" rx="4" fill="${palette.paper}"/><text class="zone-title" x="${x + 24}" y="${y + 16}">${escapeText(title)}</text>`;
}

function labelChip(x, y, label, className = 'tag') {
  const width = Math.max(56, label.length * 7 + 20);
  return `<g><rect class="protocol-label" x="${x - width / 2}" y="${y - 14}" width="${width}" height="20" rx="4"/><text class="${className}" x="${x}" y="${y}" text-anchor="middle">${escapeText(label)}</text></g>`;
}

function actorFigure(cx, y, label, sub = '') {
  const labelLines = wrapSvgText(label, 190, 8.5, 2);
  const subLines = sub ? wrapSvgText(sub, 210, 7, 2) : [];
  return `<g data-uml="actor">
    <circle class="actor-line" cx="${cx}" cy="${y + 18}" r="12"/>
    <path class="actor-line" d="M${cx} ${y + 30} V${y + 68} M${cx - 25} ${y + 43} H${cx + 25} M${cx} ${y + 68} L${cx - 22} ${y + 92} M${cx} ${y + 68} L${cx + 22} ${y + 92}"/>
    ${labelLines.map((line, index) => svgTextLine(cx, y + 114 + index * 17, line, 'name-sm')).join('')}
    ${subLines.map((line, index) => svgTextLine(cx, y + 136 + labelLines.length * 16 + index * 15, line, 'mono-xs')).join('')}
  </g>`;
}

function useCaseEllipse(x, y, width, height, label, priority = '') {
  const lines = wrapSvgText(label, width - 52, 7.2, 2);
  const firstY = y + height / 2 + (lines.length === 1 ? 5 : -3);
  const kind = priority === 'SHOULD' ? 'uml-usecase-optional' : 'uml-usecase';
  return `<g data-uml="use-case"><ellipse class="${kind}" cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}"/>
    ${lines.map((line, index) => svgTextLine(x + width / 2, firstY + index * 16, line, 'name-sm')).join('')}
    ${priority ? `<text class="tag" x="${x + width - 26}" y="${y + 18}" text-anchor="end">${escapeText(priority)}</text>` : ''}</g>`;
}

function activityAction(cx, y, width, label, kind = 'activity-action') {
  const lines = wrapSvgText(label, width - 40, 7.4, 2);
  const height = lines.length > 1 ? 70 : 60;
  const firstY = y + height / 2 + (lines.length === 1 ? 5 : -3);
  return { height, svg: `<g data-uml="activity-action"><rect class="${kind}" x="${cx - width / 2}" y="${y}" width="${width}" height="${height}" rx="22"/>
    ${lines.map((line, index) => svgTextLine(cx, firstY + index * 16, line, 'name-sm')).join('')}</g>` };
}

function activityDecision(cx, y, label) {
  const width = 250;
  const height = 88;
  const lines = wrapSvgText(label, 152, 7.2, 2);
  const firstY = y + height / 2 + (lines.length === 1 ? 5 : -3);
  return { width, height, svg: `<g data-uml="activity-decision"><path class="activity-decision" d="M${cx} ${y} L${cx + width / 2} ${y + height / 2} L${cx} ${y + height} L${cx - width / 2} ${y + height / 2} Z"/>
    ${lines.map((line, index) => svgTextLine(cx, firstY + index * 16, line, 'name-sm')).join('')}</g>` };
}

function activityInitial(cx, cy) {
  return `<g data-uml="initial"><circle cx="${cx}" cy="${cy}" r="12" fill="${palette.ink}"/><text class="tag" x="${cx + 24}" y="${cy + 4}">START</text></g>`;
}

function activityFinal(cx, cy) {
  return `<g data-uml="final"><circle class="uml-symbol" cx="${cx}" cy="${cy}" r="15"/><circle cx="${cx}" cy="${cy}" r="8" fill="${palette.ink}"/><text class="tag" x="${cx + 26}" y="${cy + 4}">END</text></g>`;
}

function databaseCylinder(x, y, width, height, title, sub = '', tag = 'DATABASE') {
  const ry = 13;
  return `<g data-architecture="database"><path class="db-fill" d="M${x} ${y + ry} C${x} ${y - 4},${x + width} ${y - 4},${x + width} ${y + ry} V${y + height - ry} C${x + width} ${y + height + 4},${x} ${y + height + 4},${x} ${y + height - ry} Z"/>
    <ellipse class="db-fill" cx="${x + width / 2}" cy="${y + ry}" rx="${width / 2}" ry="${ry}"/>
    <text class="tag" x="${x + 18}" y="${y + 34}">${escapeText(tag)}</text><text class="name-sm" x="${x + width / 2}" y="${y + 58}" text-anchor="middle">${escapeText(title)}</text>
    ${sub ? svgTextLine(x + width / 2, y + 78, wrapSvgText(sub, width - 36, 7, 1)[0], 'mono-xs') : ''}</g>`;
}

function serviceComponent(x, y, width, height, title, responsibility, tag = 'MICROSERVICE', focal = false) {
  return `<g data-architecture="component"><rect class="${focal ? 'focal' : 'service-component'}" x="${x}" y="${y}" width="${width}" height="${height}" rx="8"/>
    <rect x="${x + width - 38}" y="${y + 16}" width="20" height="12" fill="${palette.paper}" stroke="${palette.link}"/><rect x="${x + width - 44}" y="${y + 19}" width="9" height="5" fill="${palette.paper}" stroke="${palette.link}"/><rect x="${x + width - 44}" y="${y + 29}" width="9" height="5" fill="${palette.paper}" stroke="${palette.link}"/>
    <text class="tag" x="${x + 16}" y="${y + 21}">${escapeText(tag)}</text><text class="name-sm" x="${x + width / 2}" y="${y + 49}" text-anchor="middle">${escapeText(title)}</text>
    ${wrapSvgText(responsibility, width - 32, 6.9, 2).map((line,index)=>svgTextLine(x + width / 2, y + 70 + index * 15, line, 'mono-xs')).join('')}</g>`;
}

function deploymentNode(x, y, width, height, title, sub = '', stereotype = 'node', kind = 'deploy-node') {
  const depth = 12;
  const compact = height <= 88;
  const titleLines = wrapSvgText(title, width - 40, 8, compact ? 1 : 2);
  const subLines = sub ? wrapSvgText(sub, width - 40, 6.9, compact ? 1 : 2) : [];
  const tagY = y + (compact ? 20 : 28);
  const titleY = y + (compact ? 43 : 56);
  const subY = titleY + (titleLines.length - 1) * 16 + (compact ? 19 : 26);
  return `<g data-uml="deployment-node"><path class="${kind}" d="M${x} ${y + depth} L${x + depth} ${y} H${x + width} V${y + height - depth} L${x + width - depth} ${y + height} H${x} Z"/><path fill="none" stroke="${palette.muted}" d="M${x} ${y + depth} H${x + width - depth} L${x + width} ${y} M${x + width - depth} ${y + depth} V${y + height}"/>
    <text class="tag" x="${x + 18}" y="${tagY}">«${escapeText(stereotype)}»</text>
    ${titleLines.map((line,index)=>svgTextLine(x + width / 2, titleY + index * 16, line, 'name-sm')).join('')}
    ${subLines.map((line,index)=>svgTextLine(x + width / 2, subY + index * 15, line, 'mono-xs')).join('')}</g>`;
}

function renderSystemContext() {
  const width = 1760;
  const height = 1080;
  const actors = [
    ['Guest', 'Tìm và xem chuyến công khai', 108],
    ['Customer', 'Đặt vé · thanh toán · quản lý vé', 278],
    ['Driver', 'Vận hành chuyến được phân công', 448],
    ['Operator Staff', 'Quản lý nghiệp vụ trong tenant', 618],
    ['Admin', 'Quản trị toàn nền tảng', 788],
  ];
  const connectors = [
    elbow(216, 166, 392, 218, 'uml-association'),
    elbow(216, 336, 392, 218, 'uml-association'),
    elbow(216, 336, 392, 378, 'uml-association'),
    elbow(216, 506, 392, 596, 'uml-association'),
    elbow(216, 676, 392, 596, 'uml-association'),
    elbow(216, 846, 392, 596, 'uml-association'),
    straight(712, 218, 820, 218, 'edge-link', 'arrow-link'),
    straight(712, 378, 820, 378, 'edge-link', 'arrow-link'),
    straight(712, 596, 820, 596, 'edge-link', 'arrow-link'),
    elbow(1276, 332, 1460, 260, 'edge-link', 'arrow-link'),
    elbow(1276, 572, 1460, 650, 'edge-link', 'arrow-link'),
  ].join('\n');

  const body = `
    ${zone(40, 64, 248, 864, 'PEOPLE · C4 PERSON')}
    ${zone(336, 64, 424, 864, 'CLIENT CONTAINERS')}
    ${zone(804, 64, 504, 864, 'SOFTWARE SYSTEM')}
    ${zone(1416, 64, 304, 864, 'EXTERNAL SYSTEMS')}
    ${connectors}
    ${actors.map(([name, sub, y]) => actorFigure(164, y, name, sub)).join('\n')}
    ${node(392, 170, 320, 96, 'Web End-user', 'Guest · Customer · HTTPS', 'node', '«CONTAINER»')}
    ${node(392, 330, 320, 96, 'Mobile App', 'Customer · HTTPS · push token', 'node', '«CONTAINER»')}
    ${node(392, 548, 320, 96, 'Back-office Web', 'Driver · Operator Staff · Admin', 'node', '«CONTAINER»')}
    <g data-c4="software-system">
      <rect class="focal" x="820" y="152" width="456" height="568" rx="8"/>
      <text class="tag" x="848" y="184">«SOFTWARE SYSTEM»</text>
      <text class="title" x="1048" y="230" text-anchor="middle">Online Bus Ticket</text>
      <text class="title" x="1048" y="258" text-anchor="middle">Booking Platform</text>
      ${textLines(860, 318, [
        'Identity và tenant authorization',
        'Tìm chuyến, giá và availability snapshot',
        'Giữ toàn bộ ghế an toàn hoặc từ chối toàn bộ',
        'Booking · payment · cancellation · refund',
        'Ticket QR · manifest · check-in · trip operation',
        'Notification · reporting · security audit',
      ], 'body', 46)}
      <line class="footer-rule" x1="860" y1="624" x2="1236" y2="624"/>
      <text class="mono" x="1048" y="654" text-anchor="middle">Public API dùng chung cho Web · Mobile · Back-office</text>
      <text class="mono-xs" x="1048" y="682" text-anchor="middle">Ranh giới service nội bộ được mô tả ở Architecture Diagram</text>
    </g>
    ${node(1460, 212, 216, 112, 'Payment Gateway', 'Payment intent · signed webhook · refund', 'external', '«EXTERNAL SYSTEM»')}
    ${node(1460, 594, 216, 112, 'Email / Push Provider', 'Delivery only · không quyết định nghiệp vụ', 'external', '«EXTERNAL SYSTEM»')}
    ${labelChip(766, 206, 'HTTPS / JSON')}${labelChip(766, 366, 'HTTPS / JSON')}${labelChip(766, 584, 'HTTPS / JSON')}
    ${labelChip(1370, 280, 'payment · webhook')}${labelChip(1374, 624, 'delivery request')}
    <rect class="quality" x="336" y="960" width="1384" height="52" rx="8"/>
    <text class="body" x="360" y="992">Phạm vi context: người dùng, kênh truy cập, một software system và các hệ thống ngoài; không đưa database, broker hoặc microservice nội bộ vào hình này.</text>`;

  return htmlPage({
    slug: 'system-context',
    title: 'Tổng quan bối cảnh hệ thống',
    subtitle: 'Ai sử dụng sản phẩm, đi qua kênh nào và nền tảng tích hợp với hệ thống bên ngoài nào.',
    width,
    height,
    body,
    source: 'SRS 01, 02, 03 · DIA System Context',
    legend: 'Ký pháp C4 Context · Người que: Person · Hộp «container»: kênh truy cập · Cam: software system · Nét đứt: hệ thống ngoài',
  });
}

function useCaseBox(x, y, width, label, priority = '') {
  const kind = priority === 'SHOULD' ? 'rule' : 'usecase';
  const maxTextWidth = width - (priority ? 100 : 32);
  const lines = wrapSvgText(label, maxTextWidth, 7, 2);
  const firstY = lines.length === 1 ? y + 31 : y + 21;
  const text = lines.map((line, index) => svgTextLine(x + 16, firstY + index * 16, line, 'name-sm', 'start')).join('\n');
  return `<g data-node="true"><rect class="${kind}" x="${x}" y="${y}" width="${width}" height="52" rx="8"/>${text}${priority ? `<text class="tag" x="${x + width - 12}" y="${y + 16}" text-anchor="end">${escapeText(priority)}</text>` : ''}</g>`;
}

function renderUseCaseMap({ slug, title, subtitle, lanes, relationships = [], notes = [], source }) {
  const width = 2000;
  const boundaryX = 300;
  const boundaryY = 64;
  const boundaryWidth = width - 360;
  const laneGap = 32;
  const laneX = boundaryX + 40;
  const laneWidth = boundaryWidth - 80;
  const noteHeight = notes.length ? 52 + notes.length * 25 : 0;
  const actorSvg = [];
  const packages = [];
  const associations = [];
  const useCases = [];
  const positions = new Map();
  let laneY = boundaryY + 56;

  lanes.forEach((lane, laneIndex) => {
    const packageHeight = 56 + lane.cases.length * 84;
    const actorCy = laneY + packageHeight / 2;
    actorSvg.push(actorFigure(152, actorCy - 76, lane.actor, lane.actorSub || 'Primary actor'));
    packages.push(zone(laneX, laneY, laneWidth, packageHeight, `PACKAGE · ${lane.title || lane.actor.toUpperCase()}`));
    lane.cases.forEach((entry, index) => {
      const item = typeof entry === 'string' ? { label: entry } : entry;
      const ellipseWidth = 560;
      const ellipseHeight = 64;
      const ellipseX = laneX + 420;
      const ellipseY = laneY + 42 + index * 84;
      const key = item.id || item.label;
      const p = { x: ellipseX, y: ellipseY, w: ellipseWidth, h: ellipseHeight, cx: ellipseX + ellipseWidth / 2, cy: ellipseY + ellipseHeight / 2 };
      positions.set(key, p);
      useCases.push(useCaseEllipse(ellipseX, ellipseY, ellipseWidth, ellipseHeight, item.label, item.priority || ''));
      associations.push(`<line class="uml-association" x1="182" y1="${actorCy}" x2="${p.x}" y2="${p.cy}"/>`);
    });
    laneY += packageHeight + laneGap;
  });

  const boundaryHeight = laneY - boundaryY + 8;
  const noteY = boundaryY + boundaryHeight + 32;
  const height = noteY + noteHeight + 104;

  const dependencies = relationships.map((relation, relationIndex) => {
    const from = positions.get(relation.from);
    const to = positions.get(relation.to);
    if (!from || !to) throw new Error(`Unknown use-case relationship in ${slug}: ${relation.from} -> ${relation.to}`);
    const x1 = from.x + from.w;
    const y1 = from.cy;
    const x2 = to.x + to.w;
    const y2 = to.cy;
    const corridorX = boundaryX + boundaryWidth - 56 - relationIndex * 42;
    const labelX = (x1 + corridorX) / 2;
    const labelY = y1 - 10;
    const guard = relation.guard ? ` ${relation.guard}` : '';
    return `<path class="uml-dependency" d="M${x1} ${y1} H${corridorX} V${y2} H${x2}" marker-end="url(#arrow-open)"/>${labelChip(labelX, labelY, `«${relation.type}»${guard}`)}`;
  }).join('\n');

  const noteBody = notes.length ? `<rect class="quality" x="${boundaryX}" y="${noteY}" width="${boundaryWidth}" height="${noteHeight}" rx="8"/>
    <text class="tag" x="${boundaryX + 24}" y="${noteY + 26}">BUSINESS &amp; AUTHORIZATION NOTES</text>${textLines(boundaryX + 24, noteY + 52, notes, 'mono', 25)}` : '';

  return htmlPage({ slug, title, subtitle, width, height, body: `
    <rect class="uml-symbol" x="${boundaryX}" y="${boundaryY}" width="${boundaryWidth}" height="${boundaryHeight}" rx="4"/>
    <rect x="${boundaryX + 20}" y="${boundaryY - 12}" width="344" height="28" rx="4" fill="${palette.paper}"/>
    <text class="tag" x="${boundaryX + 36}" y="${boundaryY + 7}">SYSTEM BOUNDARY · ONLINE BUS TICKET BOOKING SYSTEM</text>
    ${associations.join('\n')}
    ${packages.join('\n')}
    ${dependencies}
    ${useCases.join('\n')}
    ${actorSvg.join('\n')}
    ${noteBody}`, source,
    legend: 'Ký pháp UML Use Case · Actor nằm ngoài system boundary · Ellipse tím: MUST · Ellipse vàng: SHOULD · Nét đứt qua corridor: «include»/«extend»',
  });
}

function renderActivityBooking() {
  const width = 1880;
  const height = 2520;
  const laneX = [40, 500, 960, 1420];
  const laneNames = ['CUSTOMER', 'WEB / MOBILE CLIENT', 'BOOKING PLATFORM', 'PAYMENT GATEWAY'];
  const laneWidth = 420;
  const center = laneX.map((x) => x + laneWidth / 2);
  const steps = [
    { id: 'criteria', lane: 0, y: 148, title: 'Nhập điểm đi, điểm đến, ngày và số khách' },
    { id: 'search', lane: 1, y: 244, title: 'Gửi yêu cầu tìm chuyến' },
    { id: 'find', lane: 2, y: 340, title: 'Tìm Trip còn bán theo tiêu chí', kind: 'focal' },
    { id: 'has-result', lane: 2, y: 436, title: 'Có chuyến phù hợp?', decision: true },
    { id: 'choose-trip', lane: 0, y: 562, title: 'Chọn chuyến và điểm đón/trả' },
    { id: 'show-seats', lane: 1, y: 658, title: 'Hiển thị TripSeat và thời điểm cập nhật' },
    { id: 'choose-seats', lane: 0, y: 754, title: 'Chọn một hoặc nhiều ghế' },
    { id: 'hold-request', lane: 1, y: 850, title: 'Gửi yêu cầu giữ ghế + Idempotency-Key' },
    { id: 'seat-check', lane: 2, y: 946, title: 'Mọi ghế còn AVAILABLE?', decision: true },
    { id: 'create-hold', lane: 2, y: 1066, title: 'Giữ toàn bộ ghế trong một giao dịch; một ghế lỗi thì không giữ ghế nào', kind: 'focal' },
    { id: 'countdown', lane: 1, y: 1172, title: 'Hiển thị holdToken, giá snapshot và expiresAt' },
    { id: 'passenger', lane: 0, y: 1270, title: 'Nhập đúng một Passenger cho mỗi ghế' },
    { id: 'create-booking', lane: 1, y: 1368, title: 'Gửi yêu cầu tạo Booking' },
    { id: 'hold-valid', lane: 2, y: 1466, title: 'SeatHold còn ACTIVE?', decision: true },
    { id: 'booking', lane: 2, y: 1586, title: 'Tính giá phía server và tạo Booking PENDING_PAYMENT', kind: 'focal' },
    { id: 'method', lane: 0, y: 1692, title: 'Chọn phương thức thanh toán' },
    { id: 'redirect', lane: 1, y: 1788, title: 'Mở giao diện thanh toán của provider' },
    { id: 'provider', lane: 3, y: 1884, title: 'Xử lý giao dịch và gửi webhook có chữ ký', kind: 'external' },
    { id: 'webhook', lane: 2, y: 1980, title: 'Xác minh chữ ký, amount, currency và giao dịch lặp', kind: 'focal' },
    { id: 'payment-valid', lane: 2, y: 2086, title: 'Webhook hợp lệ và payment mới?', decision: true },
    { id: 'confirm', lane: 2, y: 2206, title: 'Booking PAID · TripSeat BOOKED · Ticket ISSUED', kind: 'focal' },
    { id: 'ticket', lane: 1, y: 2312, title: 'Hiển thị vé QR và gửi thông báo', kind: 'quality' },
  ];
  const positions = new Map();
  const shapes = steps.map((step) => {
    const cx = center[step.lane];
    const shape = step.decision ? activityDecision(cx, step.y, step.title) : activityAction(cx, step.y, 344, step.title, step.kind || 'activity-action');
    const w = step.decision ? shape.width : 344;
    positions.set(step.id, { cx, x: cx - w / 2, y: step.y, w, h: shape.height, top: step.y, bottom: step.y + shape.height, cy: step.y + shape.height / 2 });
    return shape.svg;
  });
  const connect = (fromId, toId, className = 'activity-flow', marker = 'arrow') => {
    const from = positions.get(fromId);
    const to = positions.get(toId);
    return elbow(from.cx, from.bottom, to.cx, to.top, className, marker);
  };
  const mainOrder = ['criteria','search','find','has-result','choose-trip','show-seats','choose-seats','hold-request','seat-check','create-hold','countdown','passenger','create-booking','hold-valid','booking','method','redirect','provider','webhook','payment-valid','confirm','ticket'];
  const mainEdges = mainOrder.slice(0, -1).map((id, index) => connect(id, mainOrder[index + 1], index >= 18 ? 'edge-accent' : 'activity-flow', index >= 18 ? 'arrow-accent' : 'arrow'));
  const noResult = activityAction(center[1], 448, 344, 'Hiển thị không có chuyến và gợi ý đổi ngày', 'rule');
  const noSeat = activityAction(center[1], 958, 344, 'Thông báo ghế vừa bị giữ/bán; yêu cầu chọn lại', 'rule');
  const holdExpired = activityAction(center[1], 1478, 344, 'Không tạo Booking; thông báo SeatHold hết hạn', 'rule');
  const paymentRejected = activityAction(center[1], 2098, 344, 'PROCESSING: chờ/poll · FAILED: không phát hành vé', 'rule');

  const body = `
    ${laneNames.map((name, index) => `${zone(laneX[index], 56, laneWidth, 2392, name)}`).join('\n')}
    ${straight(center[0], 108, center[0], 148, 'activity-flow')}
    ${mainEdges.join('\n')}
    <line class="activity-flow" x1="${positions.get('has-result').x}" y1="${positions.get('has-result').cy}" x2="${center[1] + 172}" y2="${positions.get('has-result').cy}" marker-end="url(#arrow)"/>
    <line class="activity-flow" x1="${positions.get('seat-check').x}" y1="${positions.get('seat-check').cy}" x2="${center[1] + 172}" y2="${positions.get('seat-check').cy}" marker-end="url(#arrow)"/>
    <line class="activity-flow" x1="${positions.get('hold-valid').x}" y1="${positions.get('hold-valid').cy}" x2="${center[1] + 172}" y2="${positions.get('hold-valid').cy}" marker-end="url(#arrow)"/>
    <line class="activity-flow" x1="${positions.get('payment-valid').x}" y1="${positions.get('payment-valid').cy}" x2="${center[1] + 172}" y2="${positions.get('payment-valid').cy}" marker-end="url(#arrow)"/>
    <path class="activity-flow" d="M${center[1] - 172} ${958 + noSeat.height / 2} H468 V${positions.get('choose-seats').cy} H${positions.get('choose-seats').x + positions.get('choose-seats').w}" marker-end="url(#arrow)"/>
    <path class="activity-flow" d="M${center[1] - 172} ${1478 + holdExpired.height / 2} H484 V${positions.get('choose-seats').cy + 18} H${positions.get('choose-seats').x + positions.get('choose-seats').w}" marker-end="url(#arrow)"/>
    <line class="activity-flow" x1="${center[1]}" y1="${448 + noResult.height}" x2="${center[1]}" y2="548" marker-end="url(#arrow)"/>
    <line class="activity-flow" x1="${center[1]}" y1="${2098 + paymentRejected.height}" x2="${center[1]}" y2="2200" marker-end="url(#arrow)"/>
    ${activityInitial(center[0], 96)}
    ${shapes.join('\n')}
    ${noResult.svg}${noSeat.svg}${holdExpired.svg}${paymentRejected.svg}
    ${activityFinal(center[1], 564)}${activityFinal(center[1], 2216)}
    ${straight(center[1], positions.get('ticket').bottom, center[1], 2420, 'activity-flow')}
    ${activityFinal(center[1], 2420)}
    ${labelChip(center[2] + 150, 542, '[Có]')}${labelChip(center[1] + 206, 474, '[Không]')}
    ${labelChip(center[2] + 150, 1052, '[Có]')}${labelChip(center[1] + 206, 984, '[Không]')}
    ${labelChip(center[2] + 150, 1572, '[Còn hạn]')}${labelChip(center[1] + 206, 1504, '[Hết hạn]')}
    ${labelChip(center[2] + 150, 2200, '[Hợp lệ]')}${labelChip(center[1] + 206, 2124, '[Không hợp lệ]')}
    ${labelChip(446, 850, 'chọn lại')}${labelChip(462, 888, 'chọn lại')}`;

  return htmlPage({
    slug: 'activity-booking', title: 'Quy trình đặt vé từ tìm chuyến đến nhận vé',
    subtitle: 'Swimlane thể hiện đúng chủ thể thực hiện từng bước, các decision và sự khác nhau giữa redirect thanh toán với webhook xác nhận server.',
    width, height, body, source: 'SRS 04, 06 · BP-01 · UC-BOOK-01 · UC-PAY-01',
    legend: 'Ký pháp UML Activity · Chấm đen: bắt đầu · Vòng tròn kép: kết thúc · Hình thoi: decision · Mỗi cột là một swimlane',
  });
}

function robustnessNode(x, y, width, label, type) {
  const cx = x + width / 2;
  const cy = y + 30;
  const lines = wrapSvgText(label, width - 20, 7.1, 2);
  let symbol;
  if (type === 'ACTOR') {
    symbol = `<circle class="actor-line" cx="${cx}" cy="${cy - 15}" r="8"/><path class="actor-line" d="M${cx} ${cy - 7} V${cy + 15} M${cx - 16} ${cy} H${cx + 16} M${cx} ${cy + 15} L${cx - 14} ${cy + 29} M${cx} ${cy + 15} L${cx + 14} ${cy + 29}"/>`;
  } else if (type === 'BOUNDARY') {
    symbol = `<circle class="bce-boundary" cx="${cx}" cy="${cy}" r="22"/><path class="actor-line" d="M${cx - 34} ${cy - 22} V${cy + 22} M${cx - 34} ${cy} H${cx - 22}"/>`;
  } else if (type === 'CONTROL') {
    symbol = `<circle class="bce-control" cx="${cx}" cy="${cy}" r="22"/><path fill="none" stroke="${palette.accent}" stroke-width="1.4" d="M${cx - 9} ${cy + 5} Q${cx} ${cy - 8} ${cx + 11} ${cy + 2}"/><path fill="${palette.accent}" d="M${cx + 8} ${cy - 3} L${cx + 14} ${cy + 2} L${cx + 7} ${cy + 5} Z"/>`;
  } else {
    symbol = `<circle class="bce-entity" cx="${cx}" cy="${cy}" r="22"/><line class="bce-entity" x1="${cx - 28}" y1="${cy + 30}" x2="${cx + 28}" y2="${cy + 30}"/>`;
  }
  return `<g data-uml="bce-${type.toLowerCase()}"><text class="tag" x="${cx}" y="${y + 3}" text-anchor="middle">«${type.toLowerCase()}»</text>${symbol}
    ${lines.map((line,index)=>svgTextLine(cx, y + 78 + index * 16, line, 'name-sm')).join('')}</g>`;
}

function renderRobustness({ slug, title, subtitle, actors, boundaries, controls, entities, edges, source }) {
  const width = 1680;
  const maxRows = Math.max(actors.length, boundaries.length, controls.length, entities.length);
  const height = Math.max(900, 336 + maxRows * 104);
  const columns = {
    ACTOR: { x: 48, w: 240, items: actors },
    BOUNDARY: { x: 360, w: 280, items: boundaries },
    CONTROL: { x: 744, w: 320, items: controls },
    ENTITY: { x: 1176, w: 320, items: entities },
  };
  const positions = new Map();
  const zones = [];
  const nodes = [];
  for (const [type, column] of Object.entries(columns)) {
    zones.push(zone(column.x - 16, 64, column.w + 32, height - 272, `${type} · BCE SYMBOL`));
    column.items.forEach((label, index) => {
      const y = 112 + index * 104;
      positions.set(`${type}:${label}`, { x: column.x, y, w: column.w, cx: column.x + column.w / 2, cy: y + 30 });
      nodes.push(robustnessNode(column.x, y, column.w, label, type));
    });
  }
  const outgoing = new Map();
  const incoming = new Map();
  edges.forEach(([fromType, fromName, toType, toName], index) => {
    const fromKey = `${fromType}:${fromName}`;
    const toKey = `${toType}:${toName}`;
    if (!outgoing.has(fromKey)) outgoing.set(fromKey, []);
    if (!incoming.has(toKey)) incoming.set(toKey, []);
    outgoing.get(fromKey).push(index);
    incoming.get(toKey).push(index);
  });
  const connectorSvg = edges.map(([fromType, fromName, toType, toName, style = 'edge'], edgeIndex) => {
    const from = positions.get(`${fromType}:${fromName}`);
    const to = positions.get(`${toType}:${toName}`);
    if (!from || !to) throw new Error(`Unknown robustness edge ${fromType}:${fromName} -> ${toType}:${toName}`);
    const marker = style === 'edge-accent' ? 'arrow-accent' : 'arrow';
    if (fromType === toType) {
      const downward = to.y > from.y;
      return straight(from.cx, downward ? from.cy + 30 : from.cy - 30, to.cx, downward ? to.cy - 30 : to.cy + 30, style, marker);
    }
    const fromEdges = outgoing.get(`${fromType}:${fromName}`);
    const toEdges = incoming.get(`${toType}:${toName}`);
    const fromRank = fromEdges.indexOf(edgeIndex) + 1;
    const toRank = toEdges.indexOf(edgeIndex) + 1;
    const y1 = from.cy - 12 + fromRank * 24 / (fromEdges.length + 1);
    const y2 = to.cy - 12 + toRank * 24 / (toEdges.length + 1);
    const x1 = from.cx + 30;
    const x2 = to.cx - 30;
    const blend = (fromRank / (fromEdges.length + 1) + toRank / (toEdges.length + 1)) / 2;
    const bendX = Math.round((x1 + (x2 - x1) * (.28 + blend * .44)) / 4) * 4;
    return routedElbow(x1, y1, x2, y2, bendX, style, marker);
  }).join('\n');

  return htmlPage({ slug, title, subtitle, width, height, body: `
    ${zones.join('\n')}
    ${connectorSvg}
    ${nodes.join('\n')}
    <rect class="quality" x="48" y="${height - 172}" width="1448" height="60" rx="8"/>
    <text class="mono" x="72" y="${height - 136}">BCE: Actor → Boundary → Control → Entity. Actor không truy cập Entity; Boundary không chứa business rule.</text>`, source,
    legend: 'Ký pháp Robustness BCE · Người que: Actor · Vòng tròn có vạch: Boundary · Vòng tròn mũi tên: Control · Vòng tròn gạch chân: Entity',
  });
}

function renderBookingRobustness(spec) {
  const width = 2080;
  const height = 1480;
  const columns = { actor: {x:48,w:224}, boundary:{x:344,w:320}, controlA:{x:748,w:320}, controlB:{x:1152,w:320}, entity:{x:1552,w:440} };
  const anchor = (column, y) => ({ cx: column.x + column.w / 2, cy: y + 30 });
  const row = (y, actor, boundary, control, entity, accent = false) => {
    const a = anchor(columns.actor,y); const b = anchor(columns.boundary,y); const c = anchor(columns.controlA,y); const e = anchor(columns.entity,y);
    return `${straight(a.cx + 30, a.cy, b.cx - 30, b.cy)}${straight(b.cx + 30, b.cy, c.cx - 30, c.cy, accent ? 'edge-accent':'edge', accent ? 'arrow-accent':'arrow')}${straight(c.cx + 30, c.cy, e.cx - 30, e.cy)}
      ${robustnessNode(columns.actor.x,y,columns.actor.w,actor,'ACTOR')}${robustnessNode(columns.boundary.x,y,columns.boundary.w,boundary,'BOUNDARY')}${robustnessNode(columns.controlA.x,y,columns.controlA.w,control,'CONTROL')}${robustnessNode(columns.entity.x,y,columns.entity.w,entity,'ENTITY')}`;
  };

  const body = `
    ${zone(32, 64, 2016, 220, 'PHA 1 · TÌM CHUYẾN')}
    ${row(126, 'Customer', 'SearchPage', 'SearchTripController', 'TripSnapshot')}

    ${zone(32, 316, 2016, 592, 'PHA 2 · GIỮ GHẾ VÀ TẠO BOOKING')}
    ${row(388, 'Customer', 'SeatSelectionPage', 'SeatHoldController', 'TripSeat · SeatHold · SeatHoldItem', true)}
    ${row(548, 'Customer', 'PassengerForm · BookingAPI', 'BookingController', 'BookingItem · Passenger')}
    ${row(708, 'Customer', 'CheckoutPage', 'PricingController', 'Booking')}

    ${zone(32, 940, 2016, 356, 'PHA 3 · XÁC NHẬN THANH TOÁN VÀ PHÁT HÀNH VÉ')}
    ${row(1008, 'Payment Gateway', 'PaymentWebhookEndpoint', 'PaymentController', 'Payment · WebhookReceipt', true)}
    ${straight(columns.controlA.x + columns.controlA.w / 2 + 30, 1200, columns.controlB.x + columns.controlB.w / 2 - 30, 1200, 'edge-accent', 'arrow-accent')}
    ${straight(columns.controlB.x + columns.controlB.w / 2 + 30, 1200, columns.entity.x + columns.entity.w / 2 - 30, 1200)}
    ${robustnessNode(columns.controlA.x,1170,columns.controlA.w,'PaymentController','CONTROL')}
    ${robustnessNode(columns.controlB.x,1170,columns.controlB.w,'TicketIssuanceController','CONTROL')}
    ${robustnessNode(columns.entity.x,1170,columns.entity.w,'Booking · TripSeat · Ticket','ENTITY')}

    <rect class="quality" x="48" y="1332" width="1984" height="60" rx="8"/>
    <text class="mono" x="72" y="1368">Mỗi pha là một lát cắt use case. Redirect chỉ là Boundary phía client; webhook có chữ ký mới đi vào PaymentController và quyết định kết quả.</text>`;

  return htmlPage({ slug: spec.slug, title: spec.title, subtitle: spec.subtitle, width, height, body, source: spec.source,
    legend: 'Ký pháp Robustness BCE · Actor → Boundary → Control → Entity · Cam đậm: điểm kiểm soát giao dịch/idempotency',
  });
}

const robustnessSpecs = [
  {
    slug: 'robustness-booking', file: 'robustness-booking.html', title: 'Robustness — Đặt vé',
    subtitle: 'Các boundary, control và entity tham gia từ tìm chuyến, giữ ghế đến thanh toán và phát hành vé.',
    actors: ['Customer', 'Payment Gateway'],
    boundaries: ['SearchPage', 'TripDetailPage', 'SeatSelectionPage', 'PassengerForm', 'CheckoutPage', 'BookingAPI', 'PaymentRedirectPage', 'PaymentWebhookEndpoint'],
    controls: ['SearchTripController', 'SeatHoldController', 'BookingController', 'PricingController', 'PaymentController', 'TicketIssuanceController'],
    entities: ['TripSnapshot', 'TripSeat', 'SeatHold', 'Booking', 'BookingItem', 'Passenger', 'Payment', 'Ticket'],
    edges: [
      ['ACTOR','Customer','BOUNDARY','SearchPage'], ['BOUNDARY','SearchPage','CONTROL','SearchTripController'], ['CONTROL','SearchTripController','ENTITY','TripSnapshot'],
      ['ACTOR','Customer','BOUNDARY','SeatSelectionPage'], ['BOUNDARY','SeatSelectionPage','CONTROL','SeatHoldController'], ['CONTROL','SeatHoldController','ENTITY','TripSeat'], ['CONTROL','SeatHoldController','ENTITY','SeatHold'],
      ['ACTOR','Customer','BOUNDARY','PassengerForm'], ['BOUNDARY','PassengerForm','CONTROL','BookingController'], ['BOUNDARY','BookingAPI','CONTROL','BookingController'], ['CONTROL','BookingController','ENTITY','Passenger'], ['CONTROL','BookingController','ENTITY','BookingItem'],
      ['BOUNDARY','CheckoutPage','CONTROL','PricingController'], ['CONTROL','PricingController','ENTITY','Booking'],
      ['ACTOR','Payment Gateway','BOUNDARY','PaymentWebhookEndpoint'], ['BOUNDARY','PaymentWebhookEndpoint','CONTROL','PaymentController'], ['CONTROL','PaymentController','ENTITY','Payment'],
      ['CONTROL','PaymentController','CONTROL','TicketIssuanceController','edge-accent'], ['CONTROL','TicketIssuanceController','ENTITY','Ticket'],
    ],
    source: 'UC-BOOK-01 · UC-PAY-01 · SRS 07, 09, 12',
  },
  {
    slug: 'robustness-login', file: 'robustness-login.html', title: 'Robustness — Đăng nhập', subtitle: 'Xác thực credential, cấp token và ghi audit mà không làm lộ trạng thái tài khoản.',
    actors: ['Customer / Staff'], boundaries: ['LoginPage', 'AuthAPI'], controls: ['AuthenticationController', 'TokenController'], entities: ['User', 'RefreshToken', 'SecurityAudit'],
    edges: [['ACTOR','Customer / Staff','BOUNDARY','LoginPage'],['BOUNDARY','LoginPage','BOUNDARY','AuthAPI'],['BOUNDARY','AuthAPI','CONTROL','AuthenticationController'],['CONTROL','AuthenticationController','ENTITY','User'],['CONTROL','AuthenticationController','CONTROL','TokenController','edge-accent'],['CONTROL','TokenController','ENTITY','RefreshToken'],['CONTROL','AuthenticationController','ENTITY','SecurityAudit']], source: 'UC-AUTH-02 · SRS 07, 09, 12',
  },
  {
    slug: 'robustness-cancel-ticket', file: 'robustness-cancel-ticket.html', title: 'Robustness — Hủy vé và hoàn tiền', subtitle: 'Kiểm tra điều kiện hủy trước khi thay đổi vé và điều phối refund an toàn.',
    actors: ['Customer'], boundaries: ['TicketDetailPage', 'CancellationAPI'], controls: ['CancellationPolicyController', 'RefundController'], entities: ['Ticket', 'Booking', 'Payment', 'Refund'],
    edges: [['ACTOR','Customer','BOUNDARY','TicketDetailPage'],['BOUNDARY','TicketDetailPage','BOUNDARY','CancellationAPI'],['BOUNDARY','CancellationAPI','CONTROL','CancellationPolicyController'],['CONTROL','CancellationPolicyController','ENTITY','Ticket'],['CONTROL','CancellationPolicyController','ENTITY','Booking'],['CONTROL','CancellationPolicyController','CONTROL','RefundController','edge-accent'],['CONTROL','RefundController','ENTITY','Payment'],['CONTROL','RefundController','ENTITY','Refund']], source: 'UC-CANCEL-01 · SRS 07, 09, 12',
  },
  {
    slug: 'robustness-create-trip', file: 'robustness-create-trip.html', title: 'Robustness — Tạo và mở bán chuyến', subtitle: 'Kiểm tra route, xe, tài xế và lịch trước khi publish chuyến.',
    actors: ['Operator Staff'], boundaries: ['TripEditorPage', 'OperatorTripAPI'], controls: ['TripValidationController', 'PublishTripController'], entities: ['Trip', 'Route', 'Bus', 'DriverAssignment'],
    edges: [['ACTOR','Operator Staff','BOUNDARY','TripEditorPage'],['BOUNDARY','TripEditorPage','BOUNDARY','OperatorTripAPI'],['BOUNDARY','OperatorTripAPI','CONTROL','TripValidationController'],['CONTROL','TripValidationController','ENTITY','Route'],['CONTROL','TripValidationController','ENTITY','Bus'],['CONTROL','TripValidationController','ENTITY','DriverAssignment'],['CONTROL','TripValidationController','CONTROL','PublishTripController','edge-accent'],['CONTROL','PublishTripController','ENTITY','Trip']], source: 'UC-OPS-01 · SRS 07, 09, 12',
  },
  {
    slug: 'robustness-check-in', file: 'robustness-check-in.html', title: 'Robustness — Check-in hành khách', subtitle: 'Quét QR, kiểm quyền và chuyển trạng thái vé đúng chuyến.',
    actors: ['Driver', 'Operator Staff'], boundaries: ['ManifestPage', 'QRScanner', 'CheckInAPI'], controls: ['TicketValidationController'], entities: ['Ticket', 'TripSnapshot', 'CheckInAudit'],
    edges: [['ACTOR','Driver','BOUNDARY','ManifestPage'],['ACTOR','Operator Staff','BOUNDARY','ManifestPage'],['BOUNDARY','ManifestPage','BOUNDARY','QRScanner'],['BOUNDARY','QRScanner','BOUNDARY','CheckInAPI'],['BOUNDARY','CheckInAPI','CONTROL','TicketValidationController','edge-accent'],['CONTROL','TicketValidationController','ENTITY','Ticket'],['CONTROL','TicketValidationController','ENTITY','TripSnapshot'],['CONTROL','TicketValidationController','ENTITY','CheckInAudit']], source: 'UC-DRIVER-01 · SRS 07, 09, 12',
  },
  {
    slug: 'robustness-cancel-trip', file: 'robustness-cancel-trip.html', title: 'Robustness — Hủy chuyến', subtitle: 'Hủy Trip và điều phối các booking, refund cùng thông báo bị ảnh hưởng.',
    actors: ['Operator Staff', 'Admin'], boundaries: ['TripOperationPage', 'TripAPI'], controls: ['TripCancellationController'], entities: ['Trip', 'BookingProjection', 'Refund'],
    edges: [['ACTOR','Operator Staff','BOUNDARY','TripOperationPage'],['ACTOR','Admin','BOUNDARY','TripOperationPage'],['BOUNDARY','TripOperationPage','BOUNDARY','TripAPI'],['BOUNDARY','TripAPI','CONTROL','TripCancellationController','edge-accent'],['CONTROL','TripCancellationController','ENTITY','Trip'],['CONTROL','TripCancellationController','ENTITY','BookingProjection'],['CONTROL','TripCancellationController','ENTITY','Refund']], source: 'UC-TRIP-01 · SRS 07, 09, 12',
  },
];

function sequenceMessage(fromX, toX, y, label, type = 'sync', canvasWidth = 0) {
  const isReturn = type === 'return';
  const isAsync = type === 'async';
  const className = (isReturn || isAsync) ? 'edge-event' : (type === 'accent' ? 'edge-accent' : 'edge');
  const marker = type === 'accent' ? 'arrow-accent' : ((isAsync || isReturn) ? 'arrow-open' : 'arrow');
  const direction = toX >= fromX ? 1 : -1;
  const labelWidth = Math.min(440, Math.max(128, label.length * 7.3 + 24));
  const labelX = (fromX + toX) / 2;
  if (fromX === toX) {
    const loopDirection = canvasWidth && fromX > canvasWidth / 2 ? -1 : 1;
    const maskX = loopDirection > 0 ? fromX + 12 : fromX - 12 - labelWidth;
    const textX = loopDirection > 0 ? fromX + 20 : fromX - 20;
    const anchor = loopDirection > 0 ? 'start' : 'end';
    return `<path class="${className}" d="M${fromX} ${y} H${fromX + loopDirection * 76} V${y + 32} H${fromX + loopDirection * 4}" marker-end="url(#${marker})"/>
      <rect x="${maskX}" y="${y - 30}" width="${labelWidth}" height="18" rx="4" fill="${palette.paper}"/>
      <text class="mono" x="${textX}" y="${y - 17}" text-anchor="${anchor}">${escapeText(label)}</text>`;
  }
  return `<line class="${className}" x1="${fromX + direction * 8}" y1="${y}" x2="${toX - direction * 8}" y2="${y}" marker-end="url(#${marker})"/>
    <rect x="${labelX - labelWidth / 2}" y="${y - 30}" width="${labelWidth}" height="18" rx="4" fill="${palette.paper}"/>
    <text class="mono" x="${labelX}" y="${y - 17}" text-anchor="middle">${escapeText(label)}</text>`;
}

function renderSequence(spec) {
  const width = Math.max(1460, 300 + spec.participants.length * 280);
  const xGap = (width - 280) / (spec.participants.length - 1);
  const xs = spec.participants.map((_, index) => 140 + index * xGap);
  const startY = 200;
  const gapY = 60;
  const lastMessageY = startY + (spec.messages.length - 1) * gapY;
  const height = lastMessageY + 210;
  const lifelineEnd = height - 116;
  const actorWidth = 220;
  const fragments = (spec.fragments || []).map((fragment) => {
    const y = startY + fragment.start * gapY - 38;
    const h = (fragment.end - fragment.start + 1) * gapY + 24;
    const x = 40 + (fragment.from || 0) * xGap;
    const x2 = width - 40 - ((spec.participants.length - 1) - (fragment.to ?? spec.participants.length - 1)) * xGap;
    const dividers = (fragment.dividers || []).map((at, index) => {
      const dividerY = startY + at * gapY + 24;
      return `<line class="footer-rule" x1="${x}" y1="${dividerY}" x2="${x2}" y2="${dividerY}"/>
        <rect x="${x + 12}" y="${dividerY + 7}" width="${Math.max(120, (fragment.guards?.[index + 1] || '').length * 7)}" height="20" rx="4" fill="${palette.paper}"/>
        <text class="tag" x="${x + 20}" y="${dividerY + 21}">${escapeText(fragment.guards?.[index + 1] || 'ELSE')}</text>`;
    }).join('\n');
    return `<g><rect x="${x}" y="${y}" width="${x2 - x}" height="${h}" rx="4" fill="none" stroke="rgba(45,49,66,.38)"/>
      <path d="M${x} ${y} H${x + 96} V${y + 24} H${x}" fill="rgba(45,49,66,.06)" stroke="rgba(45,49,66,.38)"/>
      <text class="tag" x="${x + 12}" y="${y + 16}">${escapeText(fragment.kind || 'ALT')}</text>
      <text class="tag" x="${x + 112}" y="${y + 17}">${escapeText(fragment.guards?.[0] || '')}</text>${dividers}</g>`;
  }).join('\n');

  const messages = spec.messages.map((message, index) => sequenceMessage(
    xs[message[0]], xs[message[1]], startY + index * gapY, message[2], message[3] || 'sync', width,
  )).join('\n');

  const lifelines = spec.participants.map((participant, index) => {
    const [name, tag = 'PARTICIPANT'] = Array.isArray(participant) ? participant : [participant, 'PARTICIPANT'];
    const start = tag === 'ACTOR' ? 180 : 132;
    return `<line class="lifeline" x1="${xs[index]}" y1="${start}" x2="${xs[index]}" y2="${lifelineEnd}"/>`;
  }).join('\n');
  const activations = spec.participants.map((participant, participantIndex) => {
    const [, tag = 'PARTICIPANT'] = Array.isArray(participant) ? participant : [participant, 'PARTICIPANT'];
    if (tag === 'ACTOR') return '';
    const involved = spec.messages.map((message,index)=>message[0] === participantIndex || message[1] === participantIndex ? index : -1).filter(index=>index >= 0);
    if (!involved.length) return '';
    const top = startY + involved[0] * gapY - 16;
    const bottom = startY + involved[involved.length - 1] * gapY + 34;
    return `<rect class="activation" x="${xs[participantIndex] - 6}" y="${top}" width="12" height="${bottom - top}" rx="2"/>`;
  }).join('\n');
  const participantHeads = spec.participants.map((participant, index) => {
    const [name, tag = 'PARTICIPANT'] = Array.isArray(participant) ? participant : [participant, 'PARTICIPANT'];
    if (tag === 'ACTOR') return actorFigure(xs[index], 28, name, '');
    return node(xs[index] - actorWidth / 2, 56, actorWidth, 76, name, '', tag === 'EXTERNAL' ? 'external' : 'node', `«${tag.toLowerCase()}»`);
  }).join('\n');

  const note = spec.note ? `<rect class="quality" x="48" y="${height - 140}" width="${width - 96}" height="48" rx="8"/><text class="body" x="72" y="${height - 110}">${escapeText(spec.note)}</text>` : '';
  return htmlPage({ slug: spec.slug, title: spec.title, subtitle: spec.subtitle, width, height, body: `${fragments}${lifelines}${activations}${messages}${participantHeads}${note}`, source: spec.source,
    legend: 'Ký pháp UML Sequence · Mũi tên kín: gọi đồng bộ · Mũi tên mở nét đứt: return/event · Thanh xanh: activation · ALT/PAR: combined fragment',
  });
}

const sequenceSpecs = [
  {
    slug: 'sequence-seat-hold', file: 'sequence-seat-hold.html', title: 'Sequence — Giữ ghế an toàn',
    subtitle: 'Một yêu cầu nhiều ghế chỉ thành công khi tất cả ghế còn trống; nếu một ghế lỗi thì toàn bộ thao tác được hoàn tác.',
    participants: [['Customer','ACTOR'],['Web / Mobile','CLIENT'],['API Gateway','GATEWAY'],['Booking Service','SERVICE'],['Booking DB','DATABASE'],['Redis','CACHE']],
    messages: [
      [0,1,'Chọn danh sách ghế'],[1,2,'POST /seat-holds + Idempotency-Key'],[2,3,'Yêu cầu giữ ghế + identity context'],[3,4,'BEGIN transaction'],[3,4,'SELECT TripSeat FOR UPDATE'],[4,3,'Trả trạng thái hiện tại','return'],[3,3,'Kiểm tra đủ ghế, AVAILABLE và Trip sellable'],[3,4,'Update HELD + insert SeatHold/Items','accent'],[3,4,'COMMIT'],[3,5,'SET TTL helper (không phải source of truth)','async'],[4,3,'holdToken · expiresAt · price snapshot','return'],[3,2,'201 SeatHold','return'],[2,1,'holdToken · countdown','return'],[1,0,'Hiển thị thời gian giữ','return'],[3,4,'ROLLBACK · không ghế nào bị giữ'],[3,2,'409 SEAT_UNAVAILABLE','return'],[2,1,'Yêu cầu chọn lại ghế','return'],
    ],
    fragments: [{kind:'ALT',start:6,end:16,guards:['[tất cả ghế AVAILABLE]','[có ghế không AVAILABLE]'],dividers:[13]}],
    note: '“An toàn” nghĩa là giữ toàn bộ danh sách ghế hoặc không giữ ghế nào — không để lại trạng thái giữ dở dang.', source: 'UC-BOOK-01 · BR-BOOK-01/02 · DIA Sequence Seat Hold',
  },
  {
    slug: 'sequence-create-booking', file: 'sequence-create-booking.html', title: 'Sequence — Tạo đơn đặt vé', subtitle: 'Xác nhận phiên giữ, hành khách và giá trước khi tạo booking chờ thanh toán.',
    participants: [['Customer','ACTOR'],['Web / Mobile','CLIENT'],['API Gateway','GATEWAY'],['Booking Service','SERVICE'],['Booking DB','DATABASE']],
    messages: [[0,1,'Xác nhận hành khách'],[1,2,'POST /bookings'],[2,3,'holdId · passengers · requestKey'],[3,4,'Tìm SeatHold và TripSeat'],[4,3,'Hold + snapshot giá','return'],[3,3,'Kiểm tra chủ sở hữu, hạn giữ, số khách'],[3,4,'Tạo Booking + Item + Passenger'],[3,4,'Gắn hold vào booking'],[4,3,'bookingCode · amount','return'],[3,2,'201 PENDING_PAYMENT','return'],[2,1,'Booking + expiresAt','return'],[1,0,'Mở bước thanh toán','return'],[3,4,'ROLLBACK · không ghi booking'],[3,2,'410 HOLD_EXPIRED','return'],[2,1,'Hiển thị lý do và chọn lại','return']],
    fragments: [{kind:'ALT',start:4,end:14,guards:['[hold còn hiệu lực]','[hold hết hạn hoặc không thuộc user]'],dividers:[11]}], note: 'requestKey giúp client gửi lại yêu cầu sau lỗi mạng mà không tạo trùng booking.', source: 'UC-BOOK-01 · BR-BOOK-03/04 · DIA Sequence Create Booking',
  },
  {
    slug: 'sequence-payment-provider', file: 'sequence-payment-provider.html', title: 'Sequence — Khởi tạo và xác nhận thanh toán', subtitle: 'Client chỉ khởi tạo giao dịch; webhook đã xác minh từ cổng thanh toán mới là căn cứ cập nhật kết quả.',
    participants: [['Customer','ACTOR'],['Web / Mobile','CLIENT'],['API Gateway','GATEWAY'],['Payment Service','SERVICE'],['Payment Gateway','EXTERNAL']],
    messages: [[0,1,'Chọn phương thức thanh toán'],[1,2,'POST /payments'],[2,3,'bookingId · requestKey'],[3,3,'Kiểm tra booking chưa thanh toán'],[3,4,'Create payment order'],[4,3,'checkoutUrl · providerRef','return'],[3,2,'Payment PENDING + checkoutUrl','return'],[2,1,'Chuyển đến checkout','return'],[1,4,'Customer hoàn tất thanh toán'],[4,3,'POST webhook kết quả','async'],[3,3,'Xác minh chữ ký + chống xử lý trùng'],[3,3,'Lưu kết quả + outbox event'],[3,4,'200 ACK','return'],[3,3,'Ghi audit · không đổi Payment'],[3,4,'400/200 ACK không xử lý','return']],
    fragments: [{kind:'ALT',start:9,end:14,guards:['[chữ ký hợp lệ và event mới]','[không hợp lệ hoặc đã xử lý]'],dividers:[12]}], note: 'Trang redirect của khách không được dùng làm nguồn sự thật; webhook hợp lệ mới quyết định SUCCEEDED hoặc FAILED.', source: 'UC-PAY-01 · BR-PAY-01/02/03 · DIA Sequence Payment',
  },
  {
    slug: 'sequence-payment-confirm-booking', file: 'sequence-payment-confirm-booking.html', title: 'Sequence — Thanh toán xác nhận booking', subtitle: 'Payment Service ghi kết quả trước, sau đó phát sự kiện để Booking Service xác nhận ghế và đơn vé.',
    participants: [['Payment Service','SERVICE'],['Payment DB','DATABASE'],['RabbitMQ','BROKER'],['Booking Service','SERVICE'],['Booking DB','DATABASE']],
    messages: [[0,1,'Lưu Payment SUCCEEDED'],[0,1,'Ghi outbox PaymentSucceeded'],[1,0,'COMMIT','return'],[0,2,'Publish PaymentSucceeded','async'],[2,3,'Consume event','async'],[3,4,'Khóa Booking + TripSeat'],[4,3,'PENDING_PAYMENT + HELD','return'],[3,4,'Booking → PAID'],[3,4,'TripSeat → BOOKED'],[3,4,'SeatHold → CONSUMED'],[4,3,'COMMIT','return'],[3,2,'ACK event','return'],[3,2,'Publish PaymentCompensationRequested','async']],
    fragments: [{kind:'ALT',start:5,end:12,guards:['[booking và hold còn hợp lệ]','[booking đã hết hạn: bắt đầu bù trừ]'],dividers:[11]}], note: 'Outbox bảo đảm thay đổi Payment và sự kiện được ghi cùng một transaction cục bộ; consumer phải xử lý lặp an toàn.', source: 'BR-PAY-04 · BR-BOOK-05 · DIA Sequence Payment Confirmation',
  },
  {
    slug: 'sequence-ticket-delivery', file: 'sequence-ticket-delivery.html', title: 'Sequence — Phát hành và gửi vé', subtitle: 'Sau khi booking được xác nhận, hệ thống tạo vé/QR rồi gửi thông báo qua luồng sự kiện.',
    participants: [['Booking Service','SERVICE'],['Booking DB','DATABASE'],['RabbitMQ','BROKER'],['Notification Service','SERVICE'],['Customer','ACTOR']],
    messages: [[0,1,'Tạo Ticket + QR token'],[0,1,'Ghi outbox TicketIssued'],[1,0,'COMMIT','return'],[0,2,'Publish TicketIssued','async'],[2,3,'Consume TicketIssued','async'],[3,3,'Tạo message từ template'],[3,4,'Gửi email / push có link vé','async'],[4,3,'Delivery result','return'],[3,3,'Ghi DeliveryLog'],[3,2,'ACK event','return']], note: 'QR chỉ chứa token tra cứu an toàn; không nhúng dữ liệu nhạy cảm của hành khách vào mã.', source: 'UC-BOOK-01 · BR-TICKET-01 · DIA Sequence Ticket Delivery',
  },
  {
    slug: 'sequence-cancel-preview', file: 'sequence-cancel-preview.html', title: 'Sequence — Xem trước và xác nhận hủy vé', subtitle: 'Khách được xem phí hủy và tiền dự kiến hoàn trước khi xác nhận thay đổi trạng thái vé.',
    participants: [['Customer','ACTOR'],['Web / Mobile','CLIENT'],['API Gateway','GATEWAY'],['Booking Service','SERVICE'],['Booking DB','DATABASE']],
    messages: [[0,1,'Chọn Hủy vé'],[1,2,'GET /tickets/{id}/cancellation-preview'],[2,3,'Yêu cầu preview'],[3,4,'Đọc Ticket · Trip · Payment'],[4,3,'Dữ liệu chính sách','return'],[3,3,'Tính cutoff · fee · refundableAmount'],[3,2,'Preview điều khoản','return'],[2,1,'Hiển thị phí và tiền hoàn','return'],[0,1,'Xác nhận hủy'],[1,2,'POST /tickets/{id}/cancel'],[2,3,'requestKey + xác nhận'],[3,4,'Khóa ticket và kiểm tra lại điều kiện'],[3,4,'Ticket → CANCELLED + outbox'],[4,3,'Cancellation accepted','return'],[3,2,'202 Refund processing','return'],[2,1,'Vé đã hủy; hoàn tiền đang xử lý','return'],[3,4,'Không thay đổi Ticket'],[3,2,'422 NOT_CANCELLABLE','return'],[2,1,'Hiển thị lý do không thể hủy','return']],
    fragments: [{kind:'ALT',start:11,end:18,guards:['[còn trong thời hạn hủy]','[quá hạn hoặc vé đã dùng]'],dividers:[15]}], note: 'Preview chỉ để người dùng quyết định; khi xác nhận, service luôn kiểm tra lại vì trạng thái có thể đã thay đổi.', source: 'UC-CANCEL-01 · BR-CANCEL-01/02 · DIA Sequence Cancellation Preview',
  },
  {
    slug: 'sequence-refund-saga', file: 'sequence-refund-saga.html', title: 'Sequence — Điều phối hoàn tiền', subtitle: 'Luồng bù trừ sau hủy vé được điều phối qua sự kiện và có đường retry/reconciliation.',
    participants: [['Booking Service','SERVICE'],['RabbitMQ','BROKER'],['Payment Service','SERVICE'],['Payment Gateway','EXTERNAL'],['Notification Service','SERVICE']],
    messages: [[0,1,'Publish RefundRequested','async'],[1,2,'Consume RefundRequested','async'],[2,2,'Tạo Refund PENDING'],[2,3,'Create refund request'],[3,2,'providerRefundRef + accepted','return'],[2,2,'Refund → SUCCEEDED'],[2,1,'Publish RefundSucceeded','async'],[1,0,'Booking/Ticket → CANCELLED','async'],[1,4,'Gửi kết quả hoàn tiền','async'],[4,4,'Ghi DeliveryLog'],[2,1,'ACK consumed event','return'],[2,2,'Lên lịch retry có giới hạn'],[2,1,'Publish RefundFailed khi hết retry','async'],[1,4,'Thông báo đang xử lý/manual review','async']],
    fragments: [{kind:'ALT',start:3,end:13,guards:['[provider chấp nhận]','[timeout/lỗi tạm thời]'],dividers:[10]}], note: 'Job reconciliation so sánh giao dịch với provider để xử lý trường hợp webhook hoặc response bị mất.', source: 'UC-CANCEL-01 · BR-REFUND-01/02 · DIA Sequence Refund Saga',
  },
  {
    slug: 'sequence-publish-trip', file: 'sequence-publish-trip.html', title: 'Sequence — Mở bán chuyến', subtitle: 'Nhà xe chỉ có thể mở bán khi tuyến, xe, sơ đồ ghế, tài xế và lịch đều hợp lệ.',
    participants: [['Operator Staff','ACTOR'],['Back-office','CLIENT'],['Transport Service','SERVICE'],['Transport DB','DATABASE'],['RabbitMQ','BROKER']],
    messages: [[0,1,'Bấm Mở bán'],[1,2,'POST /trips/{id}/publish'],[2,3,'Khóa Trip draft và tải cấu hình'],[3,2,'Route · Bus · SeatMap · Assignment','return'],[2,2,'Kiểm tra tenant, license, lịch trùng, policy'],[2,3,'Trip → SCHEDULED'],[2,3,'Ghi outbox TripPublished'],[3,2,'COMMIT','return'],[2,4,'Publish TripPublished','async'],[2,1,'200 Trip SCHEDULED','return'],[1,0,'Hiển thị đang đồng bộ inventory','return'],[2,3,'ROLLBACK · giữ nguyên draft'],[2,1,'422 validation details','return'],[1,0,'Hiển thị lỗi cấu hình/lịch','return']],
    fragments: [{kind:'ALT',start:4,end:13,guards:['[mọi điều kiện hợp lệ]','[thiếu cấu hình hoặc xung đột lịch]'],dividers:[10]}], note: 'Booking Service dùng TripPublished để tạo snapshot và kho ghế bán vé, không đọc trực tiếp database của Transport Service.', source: 'UC-OPS-01 · BR-TRIP-01/02 · DIA Sequence Publish Trip',
  },
  {
    slug: 'sequence-cancel-trip', file: 'sequence-cancel-trip.html', title: 'Sequence — Hủy chuyến và xử lý ảnh hưởng', subtitle: 'Một lệnh hủy chuyến kích hoạt xử lý booking, refund, thông báo và báo cáo qua event choreography.',
    participants: [['Operator Staff','ACTOR'],['Transport Service','SERVICE'],['RabbitMQ','BROKER'],['Booking Service','SERVICE'],['Downstream Services','SERVICE']],
    messages: [[0,1,'POST /trips/{id}/cancel'],[1,1,'Kiểm quyền tenant + transition'],[1,1,'Trip → CANCELLED + outbox'],[1,2,'Publish TripCancelled','async'],[2,3,'Đóng inventory và tìm booking bị ảnh hưởng','async'],[3,3,'Booking/Ticket → CANCELLED'],[3,2,'Publish RefundRequested','async'],[2,4,'Payment: hoàn tiền','async'],[2,4,'Notification: báo khách','async'],[2,4,'Reporting: cập nhật projection','async'],[4,2,'Publish outcomes','async'],[2,3,'Booking → REFUNDED khi đủ refund','async']],
    fragments: [{kind:'PAR',start:7,end:10,guards:['Các consumer độc lập xử lý song song']}], note: 'Downstream Services đại diện Payment, Notification và Reporting; mỗi service tự sở hữu dữ liệu và cơ chế retry/DLQ.', source: 'UC-TRIP-01 · BR-TRIP-04 · DIA Sequence Cancel Trip',
  },
];

function renderStateDiagram(spec) {
  const stateWidth = 280;
  const rowGap = 160;
  const panelWidthRequirements = spec.panels.map((panel) => {
    const colCount = Math.max(...panel.states.map((state) => state.col || 0)) + 1;
    if (colCount <= 1) return 1960;
    const positions = new Map(panel.states.map((state) => [state.name, state]));
    const horizontalLabelWidths = panel.transitions
      .filter(([from, to, , route = 'normal']) => {
        const a = positions.get(from);
        const b = positions.get(to);
        return route === 'normal' && a && b && a.row === b.row && Math.abs(a.col - b.col) === 1;
      })
      .map(([, , label]) => Math.min(360, Math.max(128, label.length * 7.3 + 24)));
    const requiredGap = Math.max(120, ...(horizontalLabelWidths.map((value) => value + 32)));
    const gridGap = Math.ceil(requiredGap / 4) * 4;
    return 160 + colCount * stateWidth + (colCount - 1) * gridGap;
  });
  const width = Math.max(1960, ...panelWidthRequirements);
  const top = 64;
  const panelGap = 36;
  const panelHeights = spec.panels.map((panel) => 220 + Math.max(...panel.states.map((state) => state.row || 0)) * rowGap);
  const height = top + panelHeights.reduce((sum, value) => sum + value, 0) + (spec.panels.length - 1) * panelGap + 92;
  const bodies = [];
  let panelY = top;
  spec.panels.forEach((panel, panelIndex) => {
    const panelHeight = panelHeights[panelIndex];
    bodies.push(zone(40, panelY, width - 80, panelHeight, panel.title));
    const colCount = Math.max(...panel.states.map((state) => state.col || 0)) + 1;
    const gap = colCount > 1 ? (width - 160 - colCount * stateWidth) / (colCount - 1) : 0;
    const positions = new Map();
    panel.states.forEach((state) => {
      const x = 80 + state.col * (stateWidth + gap);
      const y = panelY + 72 + state.row * rowGap;
      positions.set(state.name, { x, y, cx: x + stateWidth / 2, cy: y + 38, row: state.row, col: state.col });
    });
    panel.transitions.forEach((transition, index) => {
      const [from, to, label, route = 'normal'] = transition;
      const a = positions.get(from);
      const b = positions.get(to);
      if (!a || !b) throw new Error(`Unknown state in ${spec.slug}: ${from} -> ${to}`);
      const labelWidth = Math.min(360, Math.max(128, label.length * 7.3 + 24));
      let path;
      let labelX;
      let labelY;
      if (route === 'loop-top') {
        const routeY = panelY + 48;
        path = `<path class="edge" d="M${a.cx} ${a.y} V${routeY} H${b.cx} V${b.y - 4}" marker-end="url(#arrow)"/>`;
        labelX = (a.cx + b.cx) / 2;
        labelY = routeY - 14;
      } else if (route === 'loop-left') {
        const routeX = Math.min(a.x, b.x) - 36 - (index % 2) * 22;
        path = `<path class="edge" d="M${a.x} ${a.cy} H${routeX} V${b.cy} H${b.x - 4}" marker-end="url(#arrow)"/>`;
        labelX = routeX + 12 + labelWidth / 2;
        labelY = (a.cy + b.cy) / 2 + 4;
      } else if (route === 'loop') {
        const routeX = Math.min(a.x, b.x) - 36 - (index % 2) * 22;
        path = `<path class="edge" d="M${a.x} ${a.cy} H${routeX} V${b.cy} H${b.x - 4}" marker-end="url(#arrow)"/>`;
        labelX = b.cx;
        labelY = b.y - 14;
      } else if (a.row === b.row && Math.abs(a.col - b.col) === 1) {
        const right = b.col > a.col;
        const x1 = right ? a.x + stateWidth : a.x;
        const x2 = right ? b.x : b.x + stateWidth;
        path = straight(x1, a.cy, x2, b.cy, 'edge');
        labelX = (x1 + x2) / 2;
        labelY = a.cy - 14;
      } else if (a.col === b.col && Math.abs(a.row - b.row) === 1) {
        const down = b.row > a.row;
        const y1 = down ? a.y + 76 : a.y;
        const y2 = down ? b.y : b.y + 76;
        path = straight(a.cx, y1, b.cx, y2, 'edge');
        labelX = a.cx + 12 + labelWidth / 2;
        labelY = (y1 + y2) / 2 + 4;
      } else {
        const down = b.row > a.row;
        const right = b.cx > a.cx;
        const startX = a.x + stateWidth * (right ? .72 : .28);
        const startY = down ? a.y + 76 : a.y;
        const targetX = b.x + stateWidth * (right ? .28 : .72);
        const corridorY = down ? b.y - 24 : b.y + 100;
        const targetY = down ? b.y : b.y + 76;
        path = `<path class="edge" d="M${startX} ${startY} V${corridorY} H${targetX} V${targetY}" marker-end="url(#arrow)"/>`;
        labelX = (startX + targetX) / 2;
        labelY = down ? corridorY - 8 : corridorY + 18;
      }
      bodies.push(`${path}<rect x="${labelX - labelWidth / 2}" y="${labelY - 13}" width="${labelWidth}" height="18" rx="3" fill="${palette.paper}"/><text class="mono" x="${labelX}" y="${labelY}" text-anchor="middle">${escapeText(label)}</text>`);
    });
    const initialState = positions.get(panel.initial || panel.states[0].name);
    if (initialState) {
      const startCx = initialState.x - 26;
      bodies.push(`<circle cx="${startCx}" cy="${initialState.cy}" r="9" fill="${palette.ink}"/>${straight(startCx + 10, initialState.cy, initialState.x, initialState.cy, 'edge')}`);
    }
    (panel.finals || []).forEach((stateName) => {
      const terminal = positions.get(stateName);
      if (!terminal) return;
      const finalCy = terminal.y + 124;
      bodies.push(`${straight(terminal.cx, terminal.y + 76, terminal.cx, finalCy - 16, 'edge')}<circle class="uml-symbol" cx="${terminal.cx}" cy="${finalCy}" r="14"/><circle cx="${terminal.cx}" cy="${finalCy}" r="7" fill="${palette.ink}"/>`);
    });
    panel.states.forEach((state) => {
      const p = positions.get(state.name);
      bodies.push(node(p.x, p.y, stateWidth, 76, state.name, state.sub || '', state.kind || 'state', state.tag || 'STATE'));
    });
    panelY += panelHeight + panelGap;
  });
  return htmlPage({ slug: spec.slug, title: spec.title, subtitle: spec.subtitle, width, height, body: bodies.join('\n'), source: spec.source,
    legend: 'Ký pháp UML State Machine · Chấm đen: initial · Vòng tròn kép: final · Nhãn: event [guard] / action',
  });
}

const stateSpecs = [
  {
    slug: 'state-trip-seat-hold', file: 'state-trip-seat-hold.html', title: 'State — Ghế chuyến và phiên giữ ghế', subtitle: 'Hai state machine liên quan nhưng độc lập: trạng thái bán của từng ghế và vòng đời phiên giữ.', source: 'SRS 08 · BR-BOOK-01/02/05',
    panels: [
      { title: 'TRIPSEAT — TRẠNG THÁI GHẾ TRÊN MỘT CHUYẾN', initial:'AVAILABLE', finals:['BOOKED'], states: [{name:'AVAILABLE',col:0,row:0},{name:'HELD',col:1,row:0},{name:'BOOKED',col:2,row:0},{name:'DISABLED',col:0,row:1}], transitions: [
        ['AVAILABLE','HELD','SeatHoldCreated [sellable] / lock seat'],['HELD','BOOKED','PaymentSucceeded [hold valid] / book seat'],['HELD','AVAILABLE','HoldExpired|Released / release seat','loop-top'],['AVAILABLE','DISABLED','OperatorDisabled / disable'],['DISABLED','AVAILABLE','OperatorEnabled [sellable] / enable','loop-left'],
      ]},
      { title: 'SEATHOLD — VÒNG ĐỜI PHIÊN GIỮ', initial:'ACTIVE', finals:['CONSUMED','EXPIRED','RELEASED'], states: [{name:'ACTIVE',col:1,row:0},{name:'CONSUMED',col:0,row:1},{name:'EXPIRED',col:1,row:1},{name:'RELEASED',col:2,row:1}], transitions: [
        ['ACTIVE','CONSUMED','booking confirmed'],['ACTIVE','EXPIRED','expiresAt reached'],['ACTIVE','RELEASED','customer/system release'],
      ]},
    ],
  },
  {
    slug: 'state-booking-payment', file: 'state-booking-payment.html', title: 'State — Booking và Payment', subtitle: 'Booking phản ánh cam kết nghiệp vụ; Payment phản ánh giao dịch tiền và không được đồng nhất hai trạng thái.', source: 'SRS 08 · BR-PAY · BR-BOOK',
    panels: [
      { title: 'BOOKING', initial:'PENDING_PAYMENT', finals:['COMPLETED','EXPIRED','REFUNDED'], states: [{name:'PENDING_PAYMENT',col:0,row:0},{name:'PAID',col:1,row:0},{name:'COMPLETED',col:2,row:0},{name:'CANCELLED',col:1,row:1},{name:'REFUND_PENDING',col:2,row:1},{name:'REFUNDED',col:3,row:1},{name:'EXPIRED',col:0,row:1}], transitions: [
        ['PENDING_PAYMENT','PAID','PaymentSucceeded [hold valid] / confirm seats'],['PENDING_PAYMENT','EXPIRED','expiresAt reached / release seats'],['PENDING_PAYMENT','CANCELLED','CancelRequested / release seats'],['PAID','COMPLETED','TripCompleted / close booking'],['PAID','CANCELLED','CancellationAccepted / revoke tickets'],['CANCELLED','REFUND_PENDING','refundableAmount > 0 / request refund'],['REFUND_PENDING','REFUNDED','RefundSucceeded / close compensation'],
      ]},
      { title: 'PAYMENT', initial:'PENDING', finals:['FAILED','CANCELLED','REFUNDED'], states: [{name:'PENDING',col:0,row:0},{name:'PROCESSING',col:1,row:0},{name:'SUCCEEDED',col:2,row:0},{name:'REFUND_PENDING',col:3,row:0},{name:'PARTIALLY_REFUNDED',col:4,row:0},{name:'REFUNDED',col:5,row:0},{name:'FAILED',col:1,row:1},{name:'CANCELLED',col:0,row:1}], transitions: [
        ['PENDING','PROCESSING','ProviderOrderCreated / await webhook'],['PROCESSING','SUCCEEDED','VerifiedWebhook [amount matches] / record success'],['PROCESSING','FAILED','ProviderFailure [final] / record failure'],['PENDING','CANCELLED','CustomerCancelled / close intent'],['PROCESSING','CANCELLED','ProviderCancelled / close intent'],['SUCCEEDED','REFUND_PENDING','RefundRequested / create refund'],['REFUND_PENDING','PARTIALLY_REFUNDED','PartialRefundSucceeded / update total'],['REFUND_PENDING','REFUNDED','FullRefundSucceeded / close payment'],['PARTIALLY_REFUNDED','REFUNDED','RemainingRefundSucceeded / close payment'],
      ]},
    ],
  },
  {
    slug: 'state-ticket-refund', file: 'state-ticket-refund.html', title: 'State — Ticket và Refund', subtitle: 'Vé có vòng đời sử dụng riêng; hoàn tiền có vòng đời xử lý và đối soát riêng.', source: 'SRS 08 · BR-TICKET · BR-REFUND',
    panels: [
      { title: 'TICKET', initial:'ISSUED', finals:['USED','REFUNDED'], states: [{name:'ISSUED',col:0,row:0},{name:'CHECKED_IN',col:1,row:0},{name:'USED',col:2,row:0},{name:'CANCELLED',col:0,row:1},{name:'REFUNDED',col:1,row:1}], transitions: [
        ['ISSUED','CHECKED_IN','ValidScan [correct trip] / write audit'],['CHECKED_IN','USED','TripCompleted / close usage'],['ISSUED','CANCELLED','CancellationAccepted / revoke QR'],['CANCELLED','REFUNDED','RefundSucceeded / mark refunded'],
      ]},
      { title: 'REFUND', initial:'REQUESTED', finals:['SUCCEEDED'], states: [{name:'REQUESTED',col:0,row:0},{name:'PROCESSING',col:1,row:0},{name:'SUCCEEDED',col:2,row:0},{name:'FAILED',col:1,row:1}], transitions: [
        ['REQUESTED','PROCESSING','WorkerStarted / call provider'],['PROCESSING','SUCCEEDED','ProviderConfirmed / publish outcome'],['PROCESSING','FAILED','ProviderFailure / schedule retry'],['FAILED','PROCESSING','RetryRequested [under limit] / reuse idempotency key','loop-left'],
      ]},
    ],
  },
  {
    slug: 'state-trip', file: 'state-trip.html', title: 'State — Vòng đời chuyến xe', subtitle: 'Từ soạn thảo tới mở bán, khóa bán, khởi hành, hoàn thành hoặc hủy.', source: 'SRS 08 · BR-TRIP-01/03/04',
    panels: [
      { title: 'TRIP', initial:'SCHEDULED', finals:['COMPLETED','CANCELLED'], states: [{name:'SCHEDULED',col:0,row:0},{name:'BOARDING',col:1,row:0},{name:'DEPARTED',col:2,row:0},{name:'IN_TRANSIT',col:3,row:0},{name:'ARRIVED',col:4,row:0},{name:'COMPLETED',col:5,row:0},{name:'CANCELLED',col:1,row:1}], transitions: [
        ['SCHEDULED','BOARDING','BoardingOpened [assigned] / open manifest'],['BOARDING','DEPARTED','TripStarted / close sale'],['DEPARTED','IN_TRANSIT','VehicleDeparted / update tracking'],['IN_TRANSIT','ARRIVED','DestinationReached / close boarding'],['ARRIVED','COMPLETED','TripClosed / mark checked-in tickets USED'],['SCHEDULED','CANCELLED','TripCancelled [authorized] / publish event'],['BOARDING','CANCELLED','TripCancelled [before depart] / compensate'],
      ]},
    ],
  },
];

function modelBox(x, y, width, entity, mode) {
  const items = mode === 'ERD' ? entity.fields : entity.attributes;
  const methods = mode === 'DOMAIN' ? (entity.methods || []) : [];
  const itemGap = mode === 'ERD' ? 28 : 24;
  const headerHeight = 70;
  const methodHeader = methods.length ? 32 : 0;
  const height = headerHeight + items.length * itemGap + methodHeader + methods.length * itemGap + 20;
  const tableName = entity.table || `${entity.name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}s`;
  const displayName = mode === 'ERD' ? tableName : entity.name;
  const stereotype = mode === 'ERD' ? 'table' : (entity.stereo || 'domain entity');
  let content = `<g data-node="true"><rect class="${entity.kind || 'node'}" x="${x}" y="${y}" width="${width}" height="${height}" rx="8"/>
    <path class="${mode === 'ERD' ? 'erd-header' : 'model-header'}" d="M${x + 1} ${y + 8} Q${x + 1} ${y + 1} ${x + 8} ${y + 1} H${x + width - 8} Q${x + width - 1} ${y + 1} ${x + width - 1} ${y + 8} V${y + headerHeight} H${x + 1} Z"/>
    <text class="tag" x="${x + 18}" y="${y + 22}">«${escapeText(stereotype.toLowerCase())}»</text>
    <text class="name" x="${x + 18}" y="${y + 50}">${escapeText(displayName)}</text>
    <line class="footer-rule" x1="${x}" y1="${y + headerHeight}" x2="${x + width}" y2="${y + headerHeight}"/>`;
  items.forEach((item, index) => {
    const raw = typeof item === 'string' ? item : `${item.key ? item.key + ' ' : ''}${item.name}${item.type ? ': ' + item.type : ''}`;
    if (mode === 'ERD') {
      const match = raw.match(/^(PK|UK|FK|PK\/FK)\s+(.+)$/);
      const key = match ? match[1] : '';
      const label = match ? match[2] : raw;
      const rowY = y + headerHeight + index * itemGap;
      content += `<rect x="${x + 1}" y="${rowY + 1}" width="${width - 2}" height="${itemGap - 1}" fill="${index % 2 ? 'rgba(45,49,66,.025)' : palette.white}"/>
        ${key ? `<rect class="key-badge" x="${x + 14}" y="${rowY + 6}" width="42" height="16" rx="4"/><text class="mono-xs" x="${x + 35}" y="${rowY + 17}" text-anchor="middle">${escapeText(key)}</text>` : `<text class="mono-xs" x="${x + 35}" y="${rowY + 18}" text-anchor="middle">·</text>`}
        <text class="mono" x="${x + 72}" y="${rowY + 20}">${escapeText(label)}</text>`;
    } else {
      const label = typeof item === 'string' ? `− ${item}` : `− ${item.name}${item.type ? ': ' + item.type : ''}`;
      content += `<text class="mono" x="${x + 18}" y="${y + headerHeight + 20 + index * itemGap}">${escapeText(label)}</text>`;
    }
  });
  if (methods.length) {
    const dividerY = y + headerHeight + items.length * itemGap + 10;
    content += `<line class="footer-rule" x1="${x}" y1="${dividerY}" x2="${x + width}" y2="${dividerY}"/><text class="tag" x="${x + 18}" y="${dividerY + 18}">OPERATIONS</text>`;
    methods.forEach((method, index) => {
      content += `<text class="body" x="${x + 18}" y="${dividerY + 38 + index * itemGap}">+ ${escapeText(method)}</text>`;
    });
  }
  return { svg: content + '</g>', height };
}

function renderDataModel(spec, mode) {
  const cols = 3;
  const boxWidth = 500;
  const xGap = 320;
  const width = 96 + cols * boxWidth + (cols - 1) * xGap;
  const rowHeight = mode === 'ERD' ? 300 : 350;
  const positions = new Map();
  const boxes = [];
  let maxContentBottom = 0;
  spec.entities.forEach((entity, index) => {
    const col = entity.col ?? index % cols;
    const row = entity.row ?? Math.floor(index / cols);
    const x = 48 + col * (boxWidth + xGap);
    const y = 72 + row * rowHeight;
    const box = modelBox(x, y, boxWidth, entity, mode);
    maxContentBottom = Math.max(maxContentBottom, y + box.height);
    positions.set(entity.name, { x, y, width: boxWidth, height: box.height, cx: x + boxWidth / 2, cy: y + box.height / 2, col, row });
    boxes.push(box.svg);
  });
  const height = Math.max(640, maxContentBottom + 116);
  const relationships = spec.relations.map((relation, index) => {
    const [from, to, label, cardinality = ''] = relation;
    const a = positions.get(from);
    const b = positions.get(to);
    if (!a || !b) throw new Error(`Unknown model relation in ${spec.slug}: ${from} -> ${to}`);
    let x1; let y1; let x2; let y2;
    const nonAdjacentSameRow = a.row === b.row && Math.abs(a.col - b.col) > 1;
    if (nonAdjacentSameRow) {
      const direction = b.x > a.x ? 1 : -1;
      x1 = a.cx + direction * 64;
      x2 = b.cx - direction * 64;
      y1 = a.y;
      y2 = b.y;
    } else if (a.y === b.y) {
      const right = b.x > a.x;
      x1 = right ? a.x + a.width : a.x;
      x2 = right ? b.x : b.x + b.width;
      y1 = y2 = Math.min(a.cy, b.cy) + (index % 3 - 1) * 18;
    } else {
      x1 = a.cx; x2 = b.cx;
      y1 = a.y < b.y ? a.y + a.height : a.y;
      y2 = a.y < b.y ? b.y : b.y + b.height;
    }
    const [fromCardinality = '', toCardinality = ''] = cardinality.split('—').map((value) => value.trim());
    const labelWidth = Math.min(288, Math.max(128, label.length * 7.3 + 24));
    const sameRow = y1 === y2 && !nonAdjacentSameRow;
    const sameColumn = x1 === x2;
    const bendX = Math.round((x1 + x2) / 2 / 4) * 4;
    const corridorY = Math.max(32, Math.min(a.y, b.y) - 36 - (index % 2) * 16);
    const labelX = nonAdjacentSameRow ? (x1 + x2) / 2 : sameRow ? (x1 + x2) / 2 : sameColumn ? x1 + 18 + labelWidth / 2 : bendX + 18 + labelWidth / 2;
    const labelY = nonAdjacentSameRow ? corridorY - 12 : sameRow ? y1 - 14 : (y1 + y2) / 2 + 4;
    const line = nonAdjacentSameRow
      ? `<path class="${mode === 'ERD' ? 'edge-link' : 'edge'}" d="M${x1} ${y1} V${corridorY} H${x2} V${y2}"/>`
      : orthogonalNoArrow(x1, y1, x2, y2, mode === 'ERD' ? 'edge-link' : 'edge');
    const composition = mode === 'DOMAIN' && /ROOT/.test(spec.entities.find((entity)=>entity.name === from)?.stereo || '') && /contains|orders|owns|records/i.test(label);
    const decoratedLine = composition ? line.replace('/>', ' marker-start="url(#uml-composition)"/>') : line;
    const startLabelX = x1 + (x2 >= x1 ? 16 : -16);
    const endLabelX = x2 + (x2 >= x1 ? -16 : 16);
    const anchorStart = x2 >= x1 ? 'start' : 'end';
    const anchorEnd = x2 >= x1 ? 'end' : 'start';
    const endpointY1 = y1 === y2 ? y1 - 10 : y1 + (y2 > y1 ? 18 : -8);
    const endpointY2 = y1 === y2 ? y2 - 10 : y2 + (y2 > y1 ? -8 : 18);
    return `${decoratedLine}<rect x="${labelX - labelWidth / 2 - 4}" y="${labelY - 13}" width="${labelWidth + 8}" height="18" rx="3" fill="${palette.paper}"/><text class="mono" x="${labelX}" y="${labelY}" text-anchor="middle">${escapeText(label)}</text>
      ${fromCardinality ? `<text class="tag" x="${startLabelX}" y="${endpointY1}" text-anchor="${anchorStart}">${escapeText(fromCardinality)}</text>` : ''}
      ${toCardinality ? `<text class="tag" x="${endLabelX}" y="${endpointY2}" text-anchor="${anchorEnd}">${escapeText(toCardinality)}</text>` : ''}`;
  }).join('\n');
  return htmlPage({ slug: `${mode.toLowerCase()}-${spec.slug}`, title: `${mode === 'ERD' ? 'ERD' : 'Domain Model'} — ${spec.title}`, subtitle: mode === 'ERD' ? spec.erdSubtitle : spec.domainSubtitle, width, height, body: `${relationships}${boxes.join('\n')}`, source: spec.source,
    legend: mode === 'ERD' ? 'Ký pháp ERD · PK: khóa chính · FK: khóa ngoại nội bộ service · UK: unique · Cardinality đặt tại hai đầu quan hệ' : 'Ký pháp UML Class/Domain · − thuộc tính · + hành vi · Hình thoi đen: composition trong aggregate',
  });
}

const modelSpecs = [
  {
    slug: 'identity', title: 'Identity và tổ chức', source: 'SRS 09 · Identity Service ownership',
    domainSubtitle: 'Mô hình người dùng, tenant membership và quyền theo vai trò.', erdSubtitle: 'Lược đồ dữ liệu thuộc riêng Identity Service.',
    entities: [
      {name:'User',stereo:'AGGREGATE ROOT',attributes:['id: UserId','email: Email','passwordHash','status: UserStatus'],methods:['activate()','disable()','changePassword()'],fields:['PK id: uuid','UK email: varchar','password_hash: varchar','status: varchar','created_at: timestamptz']},
      {name:'UserRole',attributes:['userId','roleId','scope'],methods:['revoke()'],fields:['PK id: uuid','FK user_id: uuid','FK role_id: uuid','scope: varchar','UK user_id + role_id + scope']},
      {name:'Role',stereo:'AGGREGATE ROOT',attributes:['id','code','scope'],methods:['grant(permission)','revoke(permission)'],fields:['PK id: uuid','UK code: varchar','scope: varchar','name: varchar']},
      {name:'Organization',stereo:'AGGREGATE ROOT',attributes:['id: OrganizationId','name','type','status'],methods:['activate()','suspend()'],fields:['PK id: uuid','UK code: varchar','name: varchar','type: varchar','status: varchar']},
      {name:'OrganizationMembership',attributes:['userId','organizationId','status'],methods:['activate()','revoke()'],fields:['PK id: uuid','FK user_id: uuid','FK organization_id: uuid','status: varchar','UK user_id + organization_id']},
      {name:'RefreshToken',attributes:['tokenHash','userId','expiresAt','revokedAt'],methods:['revoke()','isValid(now)'],fields:['PK id: uuid','FK user_id: uuid','token_hash: varchar','expires_at: timestamptz','revoked_at: timestamptz']},
      {name:'Permission',attributes:['id','resource','action'],methods:[],fields:['PK id: uuid','UK resource + action','description: varchar']},
      {name:'RolePermission',attributes:['roleId','permissionId'],methods:[],fields:['PK role_id + permission_id','FK role_id: uuid','FK permission_id: uuid']},
      {name:'SecurityAudit',stereo:'APPEND ONLY',attributes:['actorUserId','action','target','occurredAt'],methods:['append()'],fields:['PK id: uuid','FK actor_user_id: uuid nullable','action: varchar','target_ref: varchar','occurred_at: timestamptz','metadata: jsonb']},
    ],
    relations:[['User','UserRole','owns','1 — 0..*'],['Role','UserRole','assigned through','1 — 0..*'],['User','OrganizationMembership','joins tenant through','1 — 0..*'],['Organization','OrganizationMembership','contains members','1 — 0..*'],['Role','RolePermission','owns','1 — 0..*'],['Permission','RolePermission','referenced by','1 — 0..*'],['User','RefreshToken','owns','1 — 0..*'],['User','SecurityAudit','acts in','1 — 0..*']],
  },
  {
    slug: 'transport', title: 'Vận tải và lịch chuyến', source: 'SRS 09 · Transport Service ownership',
    domainSubtitle: 'Tuyến, điểm dừng, phương tiện, sơ đồ ghế, tài xế và lịch chuyến.', erdSubtitle: 'Lược đồ dữ liệu thuộc riêng Transport Service; mọi bản ghi nghiệp vụ mang organization_id.',
    entities: [
      {name:'Organization',stereo:'TENANT REFERENCE',attributes:['id','code','status'],methods:['assertActive()'],fields:['PK id: uuid','UK code: varchar','status: varchar']},
      {name:'Bus',stereo:'AGGREGATE ROOT',attributes:['id','organizationId','plateNumber','seatMapId','status'],methods:['assignSeatMap()','retire()'],fields:['PK id: uuid','FK organization_id: uuid','UK plate_number: varchar','FK seat_map_id: uuid','status: varchar']},
      {name:'SeatMap',stereo:'AGGREGATE ROOT',attributes:['id','organizationId','name','seatCount'],methods:['addSeat()','validateLayout()'],fields:['PK id: uuid','FK organization_id: uuid','name: varchar','layout_json: jsonb','seat_count: int']},
      {name:'Seat',attributes:['seatMapId','code','row','column','enabled'],methods:['disable()'],fields:['PK id: uuid','FK seat_map_id: uuid','code: varchar','row_no: int','column_no: int','enabled: boolean','UK seat_map_id + code']},
      {name:'DriverProfile',stereo:'AGGREGATE ROOT',attributes:['userId','organizationId','licenseNo','licenseExpiresAt'],methods:['isEligible(at)'],fields:['PK id: uuid','FK organization_id: uuid','user_id_external: uuid','UK license_no: varchar','license_expires_at: date','status: varchar']},
      {name:'Route',stereo:'AGGREGATE ROOT',attributes:['id','organizationId','origin','destination','status'],methods:['addStop()','activate()'],fields:['PK id: uuid','FK organization_id: uuid','origin_stop_id: uuid','destination_stop_id: uuid','status: varchar']},
      {name:'RouteStop',attributes:['routeId','stopId','sequence','offsetMinutes'],methods:[],fields:['PK id: uuid','FK route_id: uuid','FK stop_id: uuid','sequence: int','offset_minutes: int','UK route_id + sequence']},
      {name:'Stop',attributes:['id','name','province','latitude','longitude'],methods:[],fields:['PK id: uuid','name: varchar','province: varchar','latitude: decimal','longitude: decimal']},
      {name:'Trip',stereo:'AGGREGATE ROOT',attributes:['id','routeId','busId','departureAt','state'],methods:['publish()','startBoarding()','cancel(reason)'],fields:['PK id: uuid','FK organization_id: uuid','FK route_id: uuid','FK bus_id: uuid','departure_at: timestamptz','state: varchar','sellable: boolean']},
      {name:'DriverAssignment',attributes:['tripId','driverProfileId','assignedAt'],methods:['replaceDriver()'],fields:['PK id: uuid','FK trip_id: uuid','FK driver_profile_id: uuid','assigned_at: timestamptz','UK trip_id']},
    ],
    relations:[['Organization','Bus','owns','1 — 0..*'],['Organization','DriverProfile','owns','1 — 0..*'],['Organization','Route','owns','1 — 0..*'],['Organization','Trip','owns','1 — 0..*'],['Bus','SeatMap','uses','0..* — 1'],['SeatMap','Seat','contains','1 — 1..*'],['Route','RouteStop','orders','1 — 2..*'],['Stop','RouteStop','appears in','1 — 0..*'],['Trip','Route','scheduled on','0..* — 1'],['Trip','Bus','uses','0..* — 1'],['Trip','DriverAssignment','contains','1 — 1..*'],['DriverProfile','DriverAssignment','receives','1 — 0..*']],
  },
  {
    slug: 'booking', title: 'Đặt vé và kho ghế', source: 'SRS 09 · Booking Service ownership',
    domainSubtitle: 'Aggregate Booking cùng snapshot chuyến, kho ghế và vé; đây là nơi bảo vệ quy tắc không đặt trùng ghế.', erdSubtitle: 'Lược đồ dữ liệu thuộc riêng Booking Service; TripSnapshot không phải FK sang Transport DB.',
    entities: [
      {name:'TripSnapshot',attributes:['tripId','organizationId','routeLabel','departureAt','saleState'],methods:['closeInventory()'],fields:['PK trip_id: uuid','organization_id: uuid','route_label: varchar','departure_at: timestamptz','sale_state: varchar']},
      {name:'TripSeat',stereo:'INVENTORY ROOT',attributes:['tripId','seatCode','status','holdId','bookingItemId'],methods:['hold()','book()','release()','disable()'],fields:['PK trip_id + seat_code','status: varchar','hold_id: uuid nullable','booking_item_id: uuid nullable','row_version: bigint']},
      {name:'SeatHold',stereo:'AGGREGATE ROOT',attributes:['id','customerId','expiresAt','status'],methods:['isExpired(now)','consume()','release()'],fields:['PK id: uuid','customer_id_external: uuid','FK trip_id: uuid','status: varchar','expires_at: timestamptz','idempotency_key: varchar']},
      {name:'SeatHoldItem',attributes:['seatHoldId','tripId','seatCode','priceSnapshot'],methods:[],fields:['PK id: uuid','FK seat_hold_id: uuid','FK trip_id + seat_code','price_snapshot: decimal','UK seat_hold_id + seat_code']},
      {name:'Booking',stereo:'AGGREGATE ROOT',attributes:['id','bookingCode','customerId','status','totalAmount'],methods:['calculateTotal()','confirmPayment(ref)','requestCancel()','expire()'],fields:['PK id: uuid','UK booking_code: varchar','customer_id_external: uuid','FK trip_id: uuid','status: varchar','subtotal: decimal','discount: decimal','fee: decimal','total_amount: decimal']},
      {name:'BookingItem',attributes:['bookingId','tripId','seatCode','unitPrice'],methods:[],fields:['PK id: uuid','FK booking_id: uuid','FK trip_id + seat_code','unit_price: decimal','UK booking_id + seat_code']},
      {name:'Passenger',attributes:['bookingId','bookingItemId','fullName','phone','documentMasked'],methods:['maskSensitiveData()'],fields:['PK id: uuid','FK booking_id: uuid','FK booking_item_id: uuid','full_name: varchar','phone: varchar','document_encrypted: bytea']},
      {name:'Ticket',attributes:['id','bookingItemId','qrTokenHash','status'],methods:['checkIn(actor, tripId)','cancel()','markRefunded()'],fields:['PK id: uuid','UK booking_item_id: uuid','qr_token_hash: varchar','status: varchar','checked_in_at: timestamptz']},
      {name:'Promotion',stereo:'AGGREGATE ROOT',attributes:['code','validFrom','validTo','quota','conditions'],methods:['validate(context)','consumeQuota()'],fields:['PK id: uuid','UK code: varchar','valid_from: timestamptz','valid_to: timestamptz','quota: int','conditions: jsonb']},
      {name:'PromotionRedemption',attributes:['promotionId','bookingId','discountAmount'],methods:[],fields:['PK id: uuid','FK promotion_id: uuid','FK booking_id: uuid','discount_amount: decimal','UK promotion_id + booking_id']},
      {name:'Review',attributes:['ticketId','rating','comment','visibility'],methods:['publish()','hide(reason)'],fields:['PK id: uuid','UK ticket_id: uuid','rating: int','comment: text','visibility: varchar','moderated_at: timestamptz']},
    ],
    relations:[['TripSnapshot','TripSeat','contains','1 — 1..*'],['SeatHold','SeatHoldItem','contains','1 — 1..*'],['SeatHoldItem','TripSeat','reserves','0..* — 1'],['Booking','BookingItem','contains','1 — 1..*'],['Booking','Passenger','contains','1 — 1..*'],['BookingItem','Passenger','assigned to','1 — 1'],['BookingItem','TripSeat','books','0..1 — 1'],['BookingItem','Ticket','issues','1 — 0..1'],['Booking','TripSnapshot','references snapshot','0..* — 1'],['Promotion','PromotionRedemption','records','1 — 0..*'],['Booking','PromotionRedemption','applies','1 — 0..*'],['Ticket','Review','receives','1 — 0..1']],
  },
  {
    slug: 'payment', title: 'Thanh toán và hoàn tiền', source: 'SRS 09 · Payment Service ownership',
    domainSubtitle: 'Payment và Refund được thiết kế cho webhook lặp, retry và đối soát.', erdSubtitle: 'Lược đồ dữ liệu thuộc riêng Payment Service; booking_id chỉ là external reference.',
    entities: [
      {name:'Payment',stereo:'AGGREGATE ROOT',attributes:['id','bookingId','amount','status','providerRef'],methods:['markPending()','succeed()','fail()','requestRefund()'],fields:['PK id: uuid','booking_id: uuid','amount: decimal','currency: char(3)','status: varchar','provider_ref: varchar','UK provider + provider_ref']},
      {name:'PaymentAttempt',attributes:['paymentId','requestKey','requestPayloadHash','status'],methods:['complete()'],fields:['PK id: uuid','FK payment_id: uuid','UK request_key: varchar','payload_hash: varchar','status: varchar']},
      {name:'WebhookReceipt',attributes:['providerEventId','signatureValid','processedAt'],methods:['markProcessed()'],fields:['PK id: uuid','UK provider_event_id: varchar','signature_valid: boolean','payload: jsonb','processed_at: timestamptz']},
      {name:'Refund',stereo:'AGGREGATE ROOT',attributes:['id','paymentId','amount','reason','status'],methods:['start()','succeed()','fail()','retry()'],fields:['PK id: uuid','FK payment_id: uuid','amount: decimal','reason: varchar','status: varchar','idempotency_key: varchar','provider_ref: varchar']},
      {name:'ReconciliationCase',attributes:['paymentId','providerStatus','localStatus','resolution'],methods:['open()','resolve(actor)'],fields:['PK id: uuid','FK payment_id: uuid','provider_status: varchar','local_status: varchar','resolution: varchar','resolved_at: timestamptz']},
      {name:'OutboxEvent',stereo:'INFRASTRUCTURE',attributes:['aggregateId','eventType','payload','publishedAt'],methods:['markPublished()'],fields:['PK id: uuid','aggregate_id: uuid','event_type: varchar','payload: jsonb','created_at: timestamptz','published_at: timestamptz']},
      {name:'InboxMessage',stereo:'INFRASTRUCTURE',attributes:['eventId','consumer','processedAt'],methods:['claim()','markProcessed()'],fields:['PK event_id: uuid','consumer: varchar','processed_at: timestamptz','payload_hash: varchar']},
    ],
    relations:[['Payment','PaymentAttempt','contains','1 — 1..*'],['Payment','WebhookReceipt','confirmed by','1 — 0..*'],['Payment','Refund','may create','1 — 0..*'],['Payment','ReconciliationCase','opens','1 — 0..*'],['Payment','OutboxEvent','records','1 — 0..*'],['Refund','OutboxEvent','records','1 — 0..*']],
  },
];

function renderMicroservicesArchitecture() {
  const width = 2200;
  const height = 1320;
  const serviceXs = [80, 340, 600, 860, 1120, 1380];
  const serviceNames = ['Identity Service','Transport Service','Booking Service','Payment Service','Notification Service','Reporting Service'];
  const dbNames = ['Identity DB','Transport DB','Booking DB','Payment DB','Notification DB','Reporting DB'];
  const responsibilities = ['Auth · role · tenant','Fleet · route · trip','Inventory · booking · ticket','Payment · webhook · refund','Template · delivery','Read model · export'];
  const serviceY = 440;
  const dbY = 680;
  const gatewayY = 256;
  const busY = 888;
  const connectors = [];
  [240, 760, 1280].forEach((clientX) => connectors.push(straight(clientX, 192, clientX, gatewayY, 'edge-link', 'arrow-link')));
  serviceXs.forEach((x, index) => {
    const cx = x + 220 / 2;
    connectors.push(straight(cx, gatewayY + 96, cx, serviceY, 'edge-link', 'arrow-link'));
    const corridorX = x + 240;
    connectors.push(`<path class="edge-event" d="M${x + 220} ${serviceY + 56} H${corridorX} V${busY}" marker-start="url(#arrow-open)" marker-end="url(#arrow-open)"/>`);
    connectors.push(straight(cx, serviceY + 96, cx, dbY, 'edge', 'arrow'));
  });
  connectors.push(`<path class="edge-link" d="M970 ${serviceY + 96} V620 H1688 V192 H1736" marker-end="url(#arrow-link)"/>`);
  connectors.push(`<path class="edge-link" d="M1230 ${serviceY + 96} V612 H1704 V344 H1736" marker-end="url(#arrow-link)"/>`);
  connectors.push(`<path class="edge-link" d="M710 ${serviceY + 96} V628 H1720 V568 H1736" marker-end="url(#arrow-link)"/>`);
  const body = `
    ${zone(48, 64, 1584, 288, 'ENTRY CHANNELS')}
    ${zone(48, 392, 1584, 208, 'BUSINESS MICROSERVICES')}
    ${zone(48, 640, 1584, 176, 'SERVICE-OWNED DATA')}
    ${zone(48, 856, 1584, 176, 'ASYNCHRONOUS INTEGRATION')}
    ${zone(1672, 64, 480, 968, 'EXTERNAL & EPHEMERAL')}
    ${zone(48, 1072, 2104, 144, 'CROSS-CUTTING PLATFORM')}
    ${connectors.join('\n')}
    ${node(120, 112, 240, 80, 'Web End-user', 'Guest · Customer', 'node', '«CONTAINER»')}
    ${node(640, 112, 240, 80, 'Mobile App', 'Customer', 'node', '«CONTAINER»')}
    ${node(1160, 112, 240, 80, 'Back-office Web', 'Driver · Operator · Admin', 'node', '«CONTAINER»')}
    ${serviceComponent(80, gatewayY, 1520, 96, 'API Gateway / BFF', 'TLS · routing · auth context · rate limit · correlationId · public OpenAPI', 'PUBLIC ENTRY POINT', true)}
    ${serviceNames.map((name, index) => serviceComponent(serviceXs[index], serviceY, 220, 96, name, responsibilities[index], 'DEPLOYABLE SERVICE', index === 2 || index === 3)).join('\n')}
    ${dbNames.map((name, index) => databaseCylinder(serviceXs[index], dbY, 220, 88, name, 'Schema + migration riêng', 'SERVICE-OWNED DB')).join('\n')}
    <g data-architecture="broker"><path class="rule" d="M224 888 H1600 L1624 936 L1600 984 H224 L200 936 Z"/><text class="tag" x="240" y="918">«EVENT BROKER»</text><text class="name" x="912" y="940" text-anchor="middle">RabbitMQ Event Backbone</text><text class="mono" x="912" y="966" text-anchor="middle">Outbox · inbox/dedup · retry queue · dead-letter queue · correlationId</text></g>
    ${node(1736, 144, 352, 96, 'Payment Gateway', 'Chỉ Payment Service tích hợp', 'external', 'EXTERNAL')}
    ${node(1736, 296, 352, 96, 'Email / Push Provider', 'Chỉ Notification Service tích hợp', 'external', 'EXTERNAL')}
    ${databaseCylinder(1736, 520, 352, 96, 'Redis', 'TTL helper · cache · rate limit', 'EPHEMERAL STORE')}
    ${databaseCylinder(1736, 672, 352, 96, 'Object Storage', 'Export · backup artifact', 'PLATFORM STORE')}
    ${labelChip(1648, 608, 'Booking only')}${labelChip(1660, 376, 'Payment only')}${labelChip(1668, 440, 'Notification only')}
    <rect class="quality" x="1736" y="840" width="352" height="128" rx="8"/>
    <text class="tag" x="1756" y="864">INTEGRATION OWNERSHIP</text>
    ${textLines(1756, 896, ['Payment ↔ Payment Gateway','Notification ↔ Email / Push','Booking/API Gateway ↔ Redis'], 'body', 24)}
    ${node(120, 1104, 420, 72, 'Observability', 'Logs · metrics · traces · alerts', 'quality', 'PLATFORM')}
    ${node(640, 1104, 420, 72, 'Security', 'Secrets · audit · least privilege', 'quality', 'PLATFORM')}
    ${node(1160, 1104, 420, 72, 'Delivery', 'CI/CD · registry · migration', 'quality', 'PLATFORM')}
    <rect class="quality" x="1672" y="1104" width="416" height="72" rx="8"/><text class="body" x="1696" y="1136">Web, Mobile và Back-office dùng chung API.</text><text class="body" x="1696" y="1160">Mỗi service sở hữu dữ liệu của chính mình.</text>`;
  return htmlPage({ slug: 'microservices-architecture', title: 'Kiến trúc Microservices tổng thể', subtitle: 'C4 Container/Component view: deployable service theo bounded context, public contract qua Gateway, dữ liệu riêng và event contract qua broker.', width, height, body, source: 'SRS 10, 11 · DIA Microservices Architecture', legend: 'Ký pháp C4/Component · Xanh liền: REST · Nét đứt hai chiều: publish/consume event · Hình trụ: store thuộc riêng service' });
}

function renderEventFlow(spec) {
  const width = 1920;
  const height = 1160;
  const consumerStartY = 348;
  const consumerGap = 132;
  const consumerX = 1260;
  const events = spec.events.map((event, index) => {
    const y = consumerStartY + index * consumerGap;
    return { ...event, y };
  });
  const edges = events.map((event) => `<path class="edge-event" d="M420 280 H500 V${event.y + 44} H620" marker-end="url(#arrow-open)"/>
    ${straight(1080, event.y + 44, consumerX, event.y + 44, 'edge-event', 'arrow-open')}`).join('\n');
  const body = `
    ${zone(48, 72, 432, 760, 'PUBLISHER · LOCAL TRANSACTION')}
    ${zone(544, 72, 600, 760, 'BROKER · EVENT ENVELOPE')}
    ${zone(1208, 72, 664, 760, 'CONSUMER · LOCAL TRANSACTION')}
    ${edges}
    <path class="edge-accent" d="M264 204 V216 H270 V232" marker-end="url(#arrow-accent)"/>
    ${labelChip(360, 222, 'same transaction')}
    ${straight(1468, 348, 1468, 204, 'edge-event', 'arrow-open')}
    ${labelChip(1560, 224, 'inbox dedupe')}
    ${serviceComponent(96, 108, 336, 96, spec.publisher, 'Commit aggregate và OutboxEvent trong cùng transaction', 'PRODUCER', true)}
    ${databaseCylinder(120, 232, 300, 100, 'Transactional Outbox', 'unpublished → publishedAt', 'LOCAL TABLE')}
    <g data-architecture="broker"><path class="rule" d="M640 112 H1048 L1072 158 L1048 204 H640 L616 158 Z"/><text class="tag" x="656" y="142">«BROKER»</text><text class="name" x="844" y="164" text-anchor="middle">RabbitMQ Exchange</text><text class="mono-xs" x="844" y="186" text-anchor="middle">routing key · durable queue · publisher confirm</text></g>
    ${databaseCylinder(1300, 108, 336, 96, 'Consumer Inbox / Dedup', 'eventId unique · processedAt', 'LOCAL TABLE')}
    ${events.map((event) => `<g>
      <rect class="event-envelope" x="620" y="${event.y}" width="460" height="88" rx="8"/><path fill="none" stroke="${palette.purple}" d="M620 ${event.y} L850 ${event.y + 44} L1080 ${event.y}"/><text class="tag" x="638" y="${event.y + 20}">EVENT ENVELOPE · schemaVersion</text><text class="name-sm" x="638" y="${event.y + 48}">${escapeText(event.name)}</text><text class="mono" x="638" y="${event.y + 70}">${escapeText(event.key)} · eventId · correlationId</text>
      <rect class="node" x="${consumerX}" y="${event.y}" width="560" height="88" rx="8"/><text class="tag" x="${consumerX + 18}" y="${event.y + 20}">${escapeText(event.consumer)} · IDEMPOTENT HANDLER</text>
      ${wrapSvgText(event.action, 520, 7.1, 2).map((line,index)=>svgTextLine(consumerX + 18, event.y + 49 + index * 18, line, 'body', 'start')).join('')}
    </g>`).join('\n')}
    ${node(592, 240, 248, 72, 'Retry Queue', 'Backoff · giới hạn lần thử', 'rule', 'DELIVERY')}
    ${node(864, 240, 248, 72, 'Dead-letter Queue', 'Poison message · manual replay', 'rule', 'FAILURE')}
    <rect class="quality" x="48" y="872" width="1824" height="196" rx="8"/>
    <text class="tag" x="72" y="902">EVENTUAL CONSISTENCY &amp; DELIVERY CONTRACT</text>
    ${textLines(72, 936, ['1. Producer commit aggregate + OutboxEvent trong một local transaction; publisher gửi lại đến khi broker xác nhận.','2. Broker giao at-least-once; consumer ghi eventId vào Inbox trước/đồng thời với thay đổi dữ liệu cục bộ.','3. Lỗi tạm thời → retry có backoff; lỗi vĩnh viễn → DLQ + alert; replay vẫn phải idempotent.','4. Payload tối thiểu; không truy cập database của service khác; correlationId nối trace xuyên REST và event.'], 'body', 28)}`;
  return htmlPage({ slug: spec.slug, title: spec.title, subtitle: spec.subtitle, width, height, body, source: spec.source, legend: 'Ký pháp Event/Data Flow · Hình phong bì: event contract · Hình trụ: Outbox/Inbox · Nét đứt: delivery bất đồng bộ' });
}

const eventSpecs = [
  {slug:'event-trip',file:'event-trip.html',title:'Event Flow — Vòng đời chuyến',subtitle:'Sự kiện của Transport Service tạo inventory bán vé, đóng bán hoặc kích hoạt bù trừ khi hủy chuyến.',publisher:'Transport Service',source:'SRS 11 · EVT-TRIP',events:[
    {name:'TripPublished',key:'trip.published',consumer:'Booking Service',action:'Tạo TripSnapshot và TripSeat từ seat map snapshot'},
    {name:'TripUpdated',key:'trip.updated',consumer:'Booking + Reporting',action:'Cập nhật snapshot trường cho phép và projection báo cáo'},
    {name:'TripSaleClosed',key:'trip.sale-closed',consumer:'Booking Service',action:'Chặn giữ ghế và tạo booking mới'},
    {name:'TripCancelled',key:'trip.cancelled',consumer:'Booking · Payment · Notification',action:'Đóng inventory, hủy vé, hoàn tiền và thông báo'},
  ]},
  {slug:'event-payment',file:'event-payment.html',title:'Event Flow — Thanh toán',subtitle:'Payment Service công bố kết quả tiền; Booking Service quyết định trạng thái booking và vé.',publisher:'Payment Service',source:'SRS 11 · EVT-PAYMENT',events:[
    {name:'PaymentSucceeded',key:'payment.succeeded',consumer:'Booking Service',action:'Xác nhận booking, chốt TripSeat và phát hành Ticket'},
    {name:'PaymentFailed',key:'payment.failed',consumer:'Booking + Notification',action:'Cho phép thử lại hoặc hết hạn booking; báo khách'},
    {name:'RefundSucceeded',key:'refund.succeeded',consumer:'Booking + Notification',action:'Hoàn tất CANCELLED và gửi kết quả hoàn tiền'},
    {name:'RefundFailed',key:'refund.failed',consumer:'Booking + Admin projection',action:'Giữ trạng thái chờ xử lý và đưa vào manual review'},
  ]},
  {slug:'event-cancellation',file:'event-cancellation.html',title:'Event Flow — Hủy vé và bù trừ',subtitle:'Booking Service khởi phát chuỗi bù trừ, các consumer độc lập phản hồi bằng outcome event.',publisher:'Booking Service',source:'SRS 11, 14 · EVT-CANCEL',events:[
    {name:'TicketCancellationRequested',key:'ticket.cancel.requested',consumer:'Payment Service',action:'Tạo Refund nếu refundableAmount > 0'},
    {name:'RefundRequested',key:'refund.requested',consumer:'Payment Service',action:'Gọi provider theo idempotency key'},
    {name:'TicketCancelled',key:'ticket.cancelled',consumer:'Notification Service',action:'Gửi xác nhận hủy và số tiền hoàn dự kiến/thực tế'},
    {name:'BookingCancelled',key:'booking.cancelled',consumer:'Reporting Service',action:'Cập nhật doanh thu, tỷ lệ hủy và projection tenant'},
  ]},
];

function renderLocalDeployment() {
  const width = 1960;
  const height = 1336;
  const serviceNodes = [
    [520, 424, 'identity-service', 'identity_db'], [832, 424, 'transport-service', 'transport_db'], [1144, 424, 'booking-service', 'booking_db + Redis'],
    [520, 568, 'payment-service', 'payment_db'], [832, 568, 'notification-service', 'notification_db'], [1144, 568, 'reporting-service', 'reporting_db'],
  ];
  const connectors = [
    '<path class="edge-link" d="M360 208 H460 V224 H620" marker-end="url(#arrow-link)"/>',
    '<path class="edge-link" d="M360 344 H520 V264 H620" marker-end="url(#arrow-link)"/>',
    straight(960, 320, 960, 376, 'edge-link', 'arrow-link'),
    '<path class="edge" d="M964 712 V744 H708 V824" marker-end="url(#arrow)"/>',
    '<path class="edge-event" d="M964 712 V736 H1172 V824" marker-end="url(#arrow-open)"/>',
    '<path class="edge-link" d="M656 664 V732 H1492 V248 H1560" marker-end="url(#arrow-link)"/>',
    '<path class="edge-link" d="M968 664 V720 H1476 V408 H1560" marker-end="url(#arrow-link)"/>',
  ];
  const body = `
    ${zone(48, 72, 344, 1080, 'USER DEVICE')}
    ${zone(424, 72, 1060, 1080, 'DOCKER HOST · INTERNAL NETWORK')}
    ${zone(1516, 72, 396, 1080, 'EXTERNAL')}
    ${connectors.join('\n')}
    ${deploymentNode(88, 160, 272, 96, 'Browser', 'Web end-user · Back-office', 'device')}
    ${deploymentNode(88, 296, 272, 96, 'Mobile App', 'Customer channel', 'device')}
    ${deploymentNode(620, 160, 680, 160, 'Reverse Proxy / API Gateway', 'HTTPS entry · routing · auth context · public port duy nhất', 'container', 'focal')}
    <g data-uml="execution-environment"><path class="deploy-node" d="M480 388 L492 376 H1448 V700 L1436 712 H480 Z"/><path fill="none" stroke="${palette.muted}" d="M480 388 H1436 L1448 376 M1436 388 V712"/><text class="tag" x="504" y="414">«EXECUTION ENVIRONMENT» · DOCKER NETWORK</text></g>
    ${serviceNodes.map(([x,y,name,sub]) => deploymentNode(x, y, 272, 96, name, `DB ownership: ${sub}`, 'container', name.includes('booking') || name.includes('payment') ? 'focal' : 'deploy-node')).join('\n')}
    ${zone(480, 760, 920, 328, 'SHARED INFRASTRUCTURE CONTAINERS')}
    ${databaseCylinder(520, 824, 376, 104, 'PostgreSQL Server', '6 DB/schema · credential tách riêng', '«container»')}
    ${deploymentNode(984, 824, 376, 104, 'RabbitMQ', 'Durable queue · retry · DLQ', 'container', 'rule')}
    ${databaseCylinder(520, 976, 376, 80, 'Redis', 'TTL helper · cache · short lock', '«container»')}
    ${deploymentNode(984, 976, 376, 80, 'Observability Stack', 'Logs · metrics · traces', 'container', 'quality')}
    ${deploymentNode(1560, 200, 308, 96, 'Payment Gateway', 'Owner: payment-service', 'external system', 'external')}
    ${deploymentNode(1560, 360, 308, 96, 'Email / Push Provider', 'Owner: notification-service', 'external system', 'external')}
    ${labelChip(456, 208, 'HTTPS')}${labelChip(520, 320, 'HTTPS')}${labelChip(960, 356, 'internal HTTP')}${labelChip(820, 738, 'TCP')}${labelChip(1116, 730, 'AMQP')}
    <rect class="quality" x="1560" y="552" width="308" height="128" rx="8"/><text class="tag" x="1584" y="580">NETWORK RULE</text>${textLines(1584, 612, ['Không public service port','Không public DB/broker/cache','Không ghi credential vào hình'], 'body', 24)}
    <rect class="quality" x="88" y="1184" width="1780" height="40" rx="8"/><text class="body" x="112" y="1208">Containment thể hiện vị trí triển khai; quan hệ API/event chi tiết nằm ở Architecture và Event Flow diagram.</text>`;
  return htmlPage({ slug:'deployment-local-demo', title:'Deployment — Local và demo', subtitle:'UML Deployment view cho môi trường phát triển/demo: device, container, execution environment, store và đường truyền có protocol.', width, height, body, source:'SRS 16 · DIA Deployment Local/Demo', legend:'Ký pháp UML Deployment · Hộp nổi: node/container · Hình trụ: store · Nhãn trên đường: protocol · Mỗi service có DB/schema và credential riêng' });
}

function renderDeployment() {
  const width = 1960;
  const height = 1360;
  const body = `
    ${zone(48, 64, 320, 1120, 'PUBLIC CLIENTS')}
    ${zone(408, 64, 1040, 1120, 'CONTAINER PLATFORM')}
    ${zone(1488, 64, 424, 1120, 'MANAGED & EXTERNAL')}
    <path class="edge-link" d="M328 200 H360 V424 H168 V480" marker-end="url(#arrow-link)"/>
    <path class="edge-link" d="M328 336 H376 V452 H248 V480" marker-end="url(#arrow-link)"/>
    ${straight(328, 528, 488, 528, 'edge-link', 'arrow-link')}
    ${straight(668, 624, 668, 680, 'edge-link', 'arrow-link')}
    <path class="edge-link" d="M928 784 V760 H1416 V164 H1544" marker-end="url(#arrow-link)"/>
    <path class="edge-link" d="M1208 784 V748 H1432 V284 H1544" marker-end="url(#arrow-link)"/>
    <path class="edge" d="M1368 720 H1460 V468 H1544" marker-end="url(#arrow)"/>
    <path class="edge-event" d="M1368 760 H1472 V588 H1544" marker-end="url(#arrow-open)"/>
    <path class="edge" d="M1368 800 H1484 V708 H1544" marker-end="url(#arrow)"/>
    <path class="edge" d="M1368 840 H1496 V828 H1544" marker-end="url(#arrow)"/>
    ${deploymentNode(88, 160, 240, 80, 'Web Browser', 'HTTPS · responsive', 'device')}
    ${deploymentNode(88, 296, 240, 80, 'Mobile App', 'HTTPS · push token', 'device')}
    ${deploymentNode(88, 480, 240, 96, 'DNS + CDN + WAF', 'TLS · cache · protection', 'edge node', 'focal')}
    ${deploymentNode(488, 480, 360, 144, 'Load Balancer / Ingress', 'Health checks · routing · certificate · request limits', 'ingress', 'focal')}
    <g data-uml="execution-environment"><path class="deploy-node" d="M488 692 L500 680 H1368 V972 L1356 984 H488 Z"/><path fill="none" stroke="${palette.muted}" d="M488 692 H1356 L1368 680 M1356 692 V984"/><text class="tag" x="512" y="716">«EXECUTION ENVIRONMENT» · APPLICATION CLUSTER · PRIVATE NETWORK</text><text class="name" x="928" y="752" text-anchor="middle">Stateless service workloads</text></g>
    ${deploymentNode(528, 784, 240, 72, 'Identity · Transport', '2+ replicas each', 'pod')}
    ${deploymentNode(808, 784, 240, 72, 'Booking · Payment', '2+ replicas each', 'pod', 'focal')}
    ${deploymentNode(1088, 784, 240, 72, 'Notification · Reporting', 'workers · read projection', 'pod')}
    ${deploymentNode(528, 888, 240, 72, 'API Gateway', 'autoscaled', 'pod')}
    ${node(808, 888, 240, 72, 'Readiness / Liveness', 'health probes', 'quality', 'OPERATIONS')}
    ${node(1088, 888, 240, 72, 'Resource Limits', 'CPU · memory', 'quality', 'OPERATIONS')}
    ${deploymentNode(488, 1040, 264, 80, 'CI/CD', 'build · scan · rollout', 'pipeline', 'quality')}
    ${deploymentNode(792, 1040, 264, 80, 'Secrets Manager', 'rotate · inject · audit', 'managed service', 'quality')}
    ${deploymentNode(1096, 1040, 272, 80, 'Observability', 'logs · metrics · traces', 'managed service', 'quality')}
    ${deploymentNode(1544, 120, 312, 88, 'Payment Gateway', 'Owner: Payment workload', 'external system', 'external')}
    ${deploymentNode(1544, 240, 312, 88, 'Email / Push Provider', 'Owner: Notification workload', 'external system', 'external')}
    ${databaseCylinder(1544, 424, 312, 88, 'PostgreSQL cluster', 'DB/schema per service · PITR', 'MANAGED DATA')}
    ${deploymentNode(1544, 544, 312, 88, 'RabbitMQ cluster', 'Durable queue · retry · DLQ', 'managed broker', 'rule')}
    ${databaseCylinder(1544, 664, 312, 88, 'Redis cluster', 'Cache · TTL helper', 'MANAGED CACHE')}
    ${databaseCylinder(1544, 784, 312, 88, 'Object Storage', 'Export · backup artifact', 'MANAGED STORAGE')}
    ${labelChip(408, 516, 'HTTPS')}${labelChip(668, 652, 'internal HTTP')}${labelChip(1444, 456, 'TLS')}${labelChip(1460, 576, 'AMQP')}
    <rect class="quality" x="1544" y="952" width="312" height="136" rx="8"/><text class="tag" x="1568" y="980">CONNECTIVITY NOTE</text>${textLines(1568, 1012, ['Private endpoint tới data layer','Controlled egress tới provider','Không public DB/broker/cache'], 'body', 24)}
    <rect class="quality" x="48" y="1220" width="1864" height="40" rx="8"/><text class="body" x="72" y="1244">Deployment chỉ thể hiện vị trí và boundary; luồng API/event chi tiết nằm trong Architecture, Sequence và Event Flow diagram.</text>`;
  return htmlPage({ slug:'deployment', title:'Deployment — Topology gần production', subtitle:'UML Deployment view: public devices, edge/ingress, private execution environment, workload replicas, managed data và external systems.', width, height, body, source:'SRS 10, 13, 15 · DIA Deployment', legend:'Ký pháp UML Deployment · Hộp nổi: node/environment/pod · Hình trụ: managed store · Nhãn đường: protocol · Topology logic, chưa khóa cloud vendor' });
}

const artifacts = [
  {
    group: 'Tổng quan và phạm vi',
    file: 'system-context.html',
    title: 'Tổng quan bối cảnh hệ thống',
    type: 'System Context',
    source: 'SRS 01–03',
    render: renderSystemContext,
  },
  {
    group: 'Use Case và quy trình', file: 'use-cases-customer.html', title: 'Use Case — Guest và Customer', type: 'Use Case', source: 'UC-AUTH/SEARCH/BOOK/PAY/CANCEL/CHANGE',
    render: () => renderUseCaseMap({ slug: 'use-cases-customer', title: 'Use Case — Guest và Customer', subtitle: 'Chức năng công khai, tài khoản và toàn bộ vòng đời đặt vé của khách hàng.', source: 'SRS 03, 05, 07 · DIA Use Case', lanes: [
      { actor: 'Guest', actorSub: 'Chưa đăng nhập', cases: ['Đăng ký','Đăng nhập','Tìm kiếm chuyến','Xem chi tiết chuyến','Xem ghế khả dụng'] },
      { actor: 'Customer', actorSub: 'Đã xác thực', cases: ['Quản lý hồ sơ','Tìm kiếm/xem chuyến','Giữ ghế','Nhập thông tin hành khách','Tạo Booking','Tính tổng tiền phía server','Thanh toán','Xác minh kết quả payment','Phát hành vé','Xem vé và QR','Hủy vé','Xem trước phí và tiền hoàn','Hoàn tiền',{label:'Đổi vé',priority:'SHOULD'},'Giữ ghế mới',{label:'Thanh toán chênh lệch',priority:'SHOULD'},'Xem lịch sử','Đánh giá chuyến'] },
    ], relationships: [
      {from:'Tạo Booking',to:'Giữ ghế',type:'include'},{from:'Tạo Booking',to:'Nhập thông tin hành khách',type:'include'},{from:'Tạo Booking',to:'Tính tổng tiền phía server',type:'include'},
      {from:'Thanh toán',to:'Xác minh kết quả payment',type:'include'},{from:'Thanh toán',to:'Phát hành vé',type:'include'},
      {from:'Hủy vé',to:'Xem trước phí và tiền hoàn',type:'include'},{from:'Hoàn tiền',to:'Hủy vé',type:'extend',guard:'[đã trả tiền]'},
      {from:'Đổi vé',to:'Giữ ghế mới',type:'include'},{from:'Thanh toán chênh lệch',to:'Đổi vé',type:'extend',guard:'[giá mới cao hơn]'},
    ], notes:['Đăng nhập là precondition của nghiệp vụ Customer; không nối «include» vào mọi use case.','Guest không được giữ ghế hoặc tạo Booking. Customer chỉ thao tác Booking/Ticket thuộc customerId của mình.','Đổi vé là SHOULD: giữ được ghế mới trước, thất bại thì vé cũ vẫn còn hiệu lực.'] }),
  },
  {
    group: 'Use Case và quy trình', file: 'use-cases-operations.html', title: 'Use Case — Tài xế và Nhà xe', type: 'Use Case', source: 'UC-OPS/DRIVER/TRIP/REPORT',
    render: () => renderUseCaseMap({ slug: 'use-cases-operations', title: 'Use Case — Tài xế và Nhà xe', subtitle: 'Các chức năng vận hành chuyến, đội xe, check-in và báo cáo tenant.', source: 'SRS 03, 05, 07 · DIA Use Case', lanes: [
      { actor: 'Driver', actorSub: 'Chuyến được phân công', cases: ['Xem chuyến được giao','Xem manifest','Check-in hành khách','Cập nhật trạng thái chuyến'] },
      { actor: 'Operator Staff', actorSub: 'Permission + tenant scope', cases: ['Cập nhật nhà xe','Quản lý xe và sơ đồ ghế','Quản lý DriverProfile','Quản lý tuyến và điểm dừng','Tạo Trip draft','Publish chuyến','Kiểm tra cấu hình và xung đột lịch','Tạo inventory bán vé','Cập nhật chuyến','Hủy chuyến','Xử lý booking/vé bị ảnh hưởng','Gửi thông báo khách','Xem manifest/booking','Check-in hỗ trợ','Xem báo cáo tenant'] },
    ], relationships: [
      {from:'Publish chuyến',to:'Kiểm tra cấu hình và xung đột lịch',type:'include'},{from:'Publish chuyến',to:'Tạo inventory bán vé',type:'include'},
      {from:'Hủy chuyến',to:'Xử lý booking/vé bị ảnh hưởng',type:'include'},{from:'Hủy chuyến',to:'Gửi thông báo khách',type:'include'},
    ], notes:['Driver chỉ truy cập Trip có assignment còn hiệu lực và manifest tối thiểu cần thiết.','Operator Staff luôn bị giới hạn theo organizationId từ identity context; permission quyết định phạm vi fleet/schedule/operations/finance.','Trip có booking/ticket không hard delete; publish và cancellation đều idempotent và có audit.'] }),
  },
  {
    group: 'Use Case và quy trình', file: 'use-cases-admin.html', title: 'Use Case — Admin và hệ thống ngoài', type: 'Use Case', source: 'UC-ADMIN/REPORT + secondary actors',
    render: () => renderUseCaseMap({ slug: 'use-cases-admin', title: 'Use Case — Admin và hệ thống ngoài', subtitle: 'Quản trị nền tảng, tra cứu hỗ trợ và các secondary actor.', source: 'SRS 03, 05, 07 · DIA Use Case', lanes: [
      { actor: 'Admin', actorSub: 'Platform Admin / Support', cases: ['Quản lý Organization','Quản lý User','Quản lý Role và Membership','Khóa/mở khóa tài khoản','Tra cứu Booking/Payment/Refund','Kiểm duyệt Review','Xử lý khiếu nại','Xem Security Audit','Xem báo cáo nền tảng','Export báo cáo'] },
      { actor: 'Payment Gateway', actorSub: 'Secondary actor', cases: ['Tạo giao dịch provider','Xác minh webhook thanh toán','Thực hiện Refund','Đối soát giao dịch'] },
      { actor: 'Notification Provider', actorSub: 'Secondary actor', cases: ['Gửi thông báo giao dịch','Gửi Email / Push','Ghi nhận kết quả delivery'] },
    ], relationships: [
      {from:'Khóa/mở khóa tài khoản',to:'Xem Security Audit',type:'include'},{from:'Export báo cáo',to:'Xem báo cáo nền tảng',type:'extend',guard:'[dữ liệu lớn]'},
      {from:'Xác minh webhook thanh toán',to:'Tạo giao dịch provider',type:'extend',guard:'[provider callback]'},{from:'Gửi Email / Push',to:'Gửi thông báo giao dịch',type:'include'},
    ], notes:['Payment Gateway và Notification Provider là secondary actor; không quyết định trạng thái Booking/Ticket trong nền tảng.','Mọi thay đổi role, membership, user status và can thiệp payment/refund phải ghi audit append-only.','Admin tra cứu lịch sử giao dịch nhưng không được sửa bản ghi tài chính bất biến.'] }),
  },
  { group: 'Use Case và quy trình', file: 'activity-booking.html', title: 'Quy trình đặt vé từ tìm chuyến đến nhận vé', type: 'Activity / Swimlane', source: 'BP-01 · UC-BOOK · UC-PAY', render: renderActivityBooking },
  ...robustnessSpecs.map((spec) => ({ group: 'Robustness BCE', file: spec.file, title: spec.title, type: 'Robustness', source: spec.source, render: () => spec.slug === 'robustness-booking' ? renderBookingRobustness(spec) : renderRobustness(spec) })),
  ...sequenceSpecs.map((spec) => ({ group: 'Sequence nghiệp vụ', file: spec.file, title: spec.title, type: 'Sequence', source: spec.source, render: () => renderSequence(spec) })),
  ...stateSpecs.map((spec) => ({ group: 'Vòng đời trạng thái', file: spec.file, title: spec.title, type: 'State Machine', source: spec.source, render: () => renderStateDiagram(spec) })),
  ...modelSpecs.map((spec) => ({ group: 'Domain Model', file: `domain-${spec.slug}.html`, title: `Domain Model — ${spec.title}`, type: 'Domain / Class', source: spec.source, render: () => renderDataModel(spec, 'DOMAIN') })),
  ...modelSpecs.map((spec) => ({ group: 'Mô hình dữ liệu', file: `erd-${spec.slug}.html`, title: `ERD — ${spec.title}`, type: 'ERD', source: spec.source, render: () => renderDataModel(spec, 'ERD') })),
  { group: 'Kiến trúc và tích hợp', file: 'microservices-architecture.html', title: 'Kiến trúc Microservices tổng thể', type: 'Architecture', source: 'SRS 10, 11', render: renderMicroservicesArchitecture },
  ...eventSpecs.map((spec) => ({ group: 'Kiến trúc và tích hợp', file: spec.file, title: spec.title, type: 'Event Flow', source: spec.source, render: () => renderEventFlow(spec) })),
  { group: 'Triển khai', file: 'deployment-local-demo.html', title: 'Deployment — Local và demo', type: 'Deployment', source: 'SRS 16 · DIA Local/Demo', render: renderLocalDeployment },
  { group: 'Triển khai', file: 'deployment.html', title: 'Deployment — Topology gần production', type: 'Deployment', source: 'SRS 10, 13, 15', render: renderDeployment },
];

function folderForArtifact(item) {
  const folders = {
    'System Context': 'overview',
    'Use Case': 'use-cases',
    'Activity / Swimlane': 'processes',
    'Robustness': 'robustness',
    'Sequence': 'sequences',
    'State Machine': 'states',
    'Domain / Class': 'domain-models',
    'ERD': 'data-models',
    'Architecture': 'architecture',
    'Event Flow': 'events',
    'Deployment': 'deployment',
  };
  const folder = folders[item.type];
  if (!folder) throw new Error(`Chưa khai báo folder cho diagram type: ${item.type}`);
  return folder;
}

function renderIndex(items) {
  const groups = [...new Set(items.map((item) => item.group))];
  const sections = groups.map((group) => {
    const cards = items.filter((item) => item.group === group).map((item) => `
      <a class="card" href="./${folderForArtifact(item)}/${item.file}">
        <span class="card-type">${escapeText(item.type)}</span>
        <strong>${escapeText(item.title)}</strong>
        <small>${escapeText(item.source)}</small>
      </a>`).join('');
    return `<section><h2>${escapeText(group)}</h2><div class="grid">${cards}</div></section>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bộ diagram con — Online Bus Ticket Platform</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&amp;family=Geist:wght@400;500;600&amp;family=Geist+Mono:wght@500&amp;display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box}body{margin:0;padding:40px;color:${palette.ink};background:${palette.paper};font-family:'Geist',sans-serif}header{max-width:960px;margin-bottom:40px}.eyebrow{color:${palette.muted};font:500 10px 'Geist Mono',monospace;letter-spacing:.14em;text-transform:uppercase}h1{margin:8px 0 16px;font:650 48px/1.08 'Segoe UI',Arial,sans-serif;letter-spacing:-.025em}p{color:${palette.muted};font-size:16px;line-height:1.6}section{margin:36px 0}h2{margin:0 0 16px;font-size:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.card{display:flex;flex-direction:column;gap:10px;min-height:144px;padding:20px;color:inherit;text-decoration:none;background:#fff;border:1px solid rgba(45,49,66,.16);border-radius:8px}.card:hover{border-color:${palette.link}}.card-type{color:${palette.link};font:500 10px 'Geist Mono',monospace;letter-spacing:.12em;text-transform:uppercase}.card strong{font-size:18px}.card small{margin-top:auto;color:${palette.soft};font:12px 'Geist Mono',monospace}.super{display:inline-block;margin-top:8px;color:${palette.link}}
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">Online Bus Ticket Platform · Diagram Library</p>
    <h1>Bộ diagram con</h1>
    <p>Mở theo thứ tự từ tổng quan đến chi tiết. Mỗi file là một diagram độc lập, bám đúng actor, use case, trạng thái, service ownership và requirement trong SRS.</p>
    <a class="super" href="../bus-ticket-platform-super-diagram.html">Mở Super Diagram tổng hợp →</a>
  </header>
  ${sections}
</body>
</html>`;
}

for (const artifact of artifacts) {
  const folder = folderForArtifact(artifact);
  const targetDir = path.join(outputDir, folder);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, artifact.file), artifact.render(), 'utf8');
  const legacyPath = path.join(outputDir, artifact.file);
  if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
}
fs.writeFileSync(path.join(outputDir, 'index.html'), renderIndex(artifacts), 'utf8');

console.log(`Generated ${artifacts.length} diagrams in ${new Set(artifacts.map(folderForArtifact)).size} folders + index in ${outputDir}`);

'use strict';

const wordMapSketch = function(p) {
    const TURN_MARKER = '\n';
    const wordData = {
        objects: ['Pillow', 'Blanket', 'Cup', 'Diary', 'Photos', 'Furniture', 'Window', 'Desk', 'Laptop', 'people'],
        actions: ['songs', 'Cleaning', 'Sleep', 'Lying-down', 'Cook', 'smell']
    };
    const defaultText = [...wordData.objects, ...wordData.actions].join(TURN_MARKER);

    let textTyped = defaultText;
    let userText = '';
    let centerX, centerY, offsetX, offsetY, zoom;
    let actRandomSeed;
    let colors = [];
    let pathCommands = [];
    let pathVertices = [];
    let floorPlanElements = [];
    let contentBounds = createEmptyBounds();
    let autoZoom = 1;
    let lockedExtraLength = 0;
    let canvasElement = null;
    let infoBound = false;

    const ui = {
        canvasHolder: document.getElementById('canvas-holder'),
        infoToggle: document.getElementById('infoToggle'),
        infoPanel: document.getElementById('infoPanel'),
        infoClose: document.getElementById('infoClose')
    };

    const FIREBASE_COLLECTION = 'wordMaps';
    const FIREBASE_DOCUMENT_ID = 'sharedRoad';
    let firebaseDocRef = null;
    let firebaseInitialized = false;
    let firebaseSaveTimer = null;
    let isApplyingRemoteUpdate = false;

    p.setup = function() {
        const bounds = getCanvasBounds();
        canvasElement = p.createCanvas(bounds.width, bounds.height);
        if (ui.canvasHolder) {
            canvasElement.parent(ui.canvasHolder);
        }
        colors = [
            p.color(230, 57, 70), p.color(241, 196, 15), p.color(29, 131, 225),
            p.color(106, 77, 153), p.color(69, 179, 157), p.color(243, 156, 18)
        ];
        actRandomSeed = p.floor(p.random(1000));
        p.textFont('monospace', 25);
        p.textAlign(p.LEFT, p.BASELINE);

        // ✨ 기본 문장을 포함한 경로를 미리 생성
        refreshTextAndPaths();

        // ✨ 시작점을 레이아웃 중앙으로 설정하고 줌 레벨을 고정
        centerX = bounds.width / 2;
        centerY = bounds.height / 2;
        zoom = 1.0;

        offsetX = 0;
        offsetY = 0;
        p.cursor(p.HAND);

        ensureFirebaseSync();
        bindInfoPanel();
    };

    p.draw = function() {
        p.background(255);
        if (p.mouseIsPressed && p.mouseButton === p.LEFT) {
            centerX = p.mouseX - offsetX;
            centerY = p.mouseY - offsetY;
        }

        p.push();
        p.translate(centerX, centerY);
        p.scale(autoZoom * zoom);
        const centeredX = contentBounds.centerX || 0;
        const centeredY = contentBounds.centerY || 0;
        p.translate(-centeredX, -centeredY);

        p.push();
        const planOffsetX = p.textWidth('M') * 6;
        const planOffsetY = p.textWidth('M') * 4;
        p.translate(planOffsetX, planOffsetY);
        drawFloorPlan();
        p.pop();

        // 미리 계산된 명령어들을 순서대로 실행하여 그리기
        for (const cmd of pathCommands) {
            p.noStroke();
            if (cmd.type === 'char') {
                p.fill(0);
                p.text(cmd.value, 0, 0);
                p.translate(p.textWidth(cmd.value), 0);
            } else if (cmd.type === 'turn') {
                drawJoint(cmd.degrees, cmd.direction);
            }
        }

        p.fill(0);
        if (p.frameCount / 12 % 2 < 1) p.rect(0, -10, 8, 1.5);
        p.pop();
    };

    function drawJoint(turnDegrees, direction) {
        const angle = p.radians(turnDegrees) * direction;
        p.rotate(angle);
    }

    // ✨ --- START: 겹침 방지 경로를 생성하는 새로운 핵심 함수 --- ✨
    function generatePathCommands() {
        const commands = [];
        let x = 0,
            y = 0,
            angle = 0;

        const gridSize = 32;
        const visitedCells = new Set();
        visitedCells.add('0,0');

        p.randomSeed(actRandomSeed);
        let colorIndex = 0;
        pathVertices = [{
            x: 0,
            y: 0,
            angle: 0
        }];
        for (let i = 0; i < textTyped.length; i++) {
            const letter = textTyped.charAt(i);
            if (letter === TURN_MARKER) {
                const currentCellX = p.round(x / gridSize);
                const currentCellY = p.round(y / gridSize);

                const potentialTurns = [{
                        degrees: 90,
                        direction: 1
                    },
                    {
                        degrees: 90,
                        direction: -1
                    },
                    {
                        degrees: 180,
                        direction: 1
                    }
                ];

                const shuffled = p.shuffle ? p.shuffle([...potentialTurns]) : potentialTurns;
                let chosenTurn = shuffled.find((turn) => {
                    const nextAngle = angle + p.radians(turn.degrees * turn.direction);
                    const nextCellX = currentCellX + p.round(p.cos(nextAngle));
                    const nextCellY = currentCellY + p.round(p.sin(nextAngle));
                    return !visitedCells.has(`${nextCellX},${nextCellY}`);
                });

                if (!chosenTurn) {
                    chosenTurn = {
                        degrees: 180,
                        direction: 1
                    };
                }

                commands.push({
                    type: 'turn',
                    degrees: chosenTurn.degrees,
                    direction: chosenTurn.direction,
                    color: colors[colorIndex]
                });
                colorIndex = (colorIndex + 1) % colors.length;

                const angleDelta = p.radians(chosenTurn.degrees * chosenTurn.direction);
                angle += angleDelta;
                const branchGap = p.textWidth('M') * 5;
                x += p.cos(angle) * branchGap;
                y += p.sin(angle) * branchGap;
                pathVertices.push({
                    x,
                    y,
                    angle
                });

            } else {
                const prevX = x;
                const prevY = y;
                commands.push({
                    type: 'char',
                    value: letter
                });
                const advance = p.textWidth(letter) + 12;
                x += p.cos(angle) * advance;
                y += p.sin(angle) * advance;
                pathVertices.push({
                    x,
                    y,
                    angle
                });
            }

            const cellX = p.round(x / gridSize);
            const cellY = p.round(y / gridSize);
            visitedCells.add(`${cellX},${cellY}`);
        }

        return commands;
    }
    // ✨ --- END: 새로운 핵심 함수 --- ✨

    function createEmptyBounds() {
        return {
            minX: 0,
            maxX: 0,
            minY: 0,
            maxY: 0,
            width: 0,
            height: 0,
            centerX: 0,
            centerY: 0
        };
    }

    function computeContentBounds(vertices = []) {
        if (!vertices.length) return createEmptyBounds();
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const vertex of vertices) {
            if (vertex.x < minX) minX = vertex.x;
            if (vertex.x > maxX) maxX = vertex.x;
            if (vertex.y < minY) minY = vertex.y;
            if (vertex.y > maxY) maxY = vertex.y;
        }
        const width = maxX - minX;
        const height = maxY - minY;
        return {
            minX,
            maxX,
            minY,
            maxY,
            width,
            height,
            centerX: minX + width / 2,
            centerY: minY + height / 2
        };
    }

    function computeAutoZoom(bounds) {
        if (!bounds) return 1;
        const margin = 160;
        const drawableWidth = Math.max(80, p.width - margin);
        const drawableHeight = Math.max(80, p.height - margin);
        const contentWidth = Math.max(1, bounds.width);
        const contentHeight = Math.max(1, bounds.height);
        const fitX = drawableWidth / contentWidth;
        const fitY = drawableHeight / contentHeight;
        const fitScale = Math.min(1, fitX, fitY);
        if (!isFinite(fitScale) || fitScale <= 0) return 1;
        return fitScale;
    }

    function updateAutoZoom() {
        autoZoom = computeAutoZoom(contentBounds);
    }

    function clampLockedExtraLength() {
        lockedExtraLength = Math.max(0, Math.min(lockedExtraLength, userText.length));
    }

    function isFormFieldFocused() {
        const active = document.activeElement;
        if (!active) return false;
        const tag = active.tagName;
        if (!tag) return false;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
        return active.isContentEditable === true;
    }

    function composeFullText() {
        if (!userText || userText.length === 0) return defaultText;
        const needsPrefix = !userText.startsWith(TURN_MARKER);
        const bridge = needsPrefix ? TURN_MARKER : '';
        return `${defaultText}${bridge}${userText}`;
    }

    function refreshTextAndPaths() {
        textTyped = composeFullText();
        pathCommands = generatePathCommands();
        contentBounds = computeContentBounds(pathVertices);
        updateAutoZoom();
        floorPlanElements = buildFloorPlanFromVertices(pathVertices);
    }

    function handleLocalTextChange() {
        refreshTextAndPaths();
        queueSaveToFirebase();
    }

    function bindInfoPanel() {
        if (infoBound) return;
        const toggle = ui.infoToggle;
        const panel = ui.infoPanel;
        const closeBtn = ui.infoClose;
        if (!toggle || !panel) return;
        const setState = (open) => {
            panel.classList.toggle('open', open);
            panel.setAttribute('aria-hidden', (!open).toString());
            toggle.setAttribute('aria-expanded', open.toString());
        };
        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('open');
            setState(!isOpen);
        });
        if (closeBtn) {
            closeBtn.addEventListener('click', () => setState(false));
        }
        infoBound = true;
    }

    function getCanvasBounds() {
        if (ui.canvasHolder) {
            const rect = ui.canvasHolder.getBoundingClientRect();
            return {
                width: Math.max(200, rect.width),
                height: Math.max(200, rect.height)
            };
        }
        return {
            width: p.windowWidth,
            height: p.windowHeight
        };
    }

    function resizeCanvasForLayout(recenter = false) {
        if (!canvasElement) return;
        const bounds = getCanvasBounds();
        p.resizeCanvas(bounds.width, bounds.height);
        updateAutoZoom();
        if (recenter) {
            centerX = bounds.width / 2;
            centerY = bounds.height / 2;
        }
    }

    function buildFloorPlanFromVertices(vertices = []) {
        const elements = [];
        if (vertices.length < 2) return elements;
        const wallThickness = 38;
        p.randomSeed(actRandomSeed + 5000);

        for (let i = 1; i < vertices.length; i++) {
            const prev = vertices[i - 1];
            const curr = vertices[i];
            const len = p.dist(prev.x, prev.y, curr.x, curr.y);
            if (len < 6) continue;
            const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);

            const corridorElement = {
                type: 'corridor',
                x: prev.x,
                y: prev.y,
                len,
                angle,
                thickness: wallThickness,
                dashed: p.random() < 0.45,
                gaps: []
            };
            elements.push(corridorElement);

            if (len > 60 && p.random() < 0.35) {
                const offset = p.random(18, len - 18);
                const side = p.random([1, -1]);
                const gapHalf = Math.min(24, len / 6);
                const gapStart = Math.max(0, offset - gapHalf);
                const gapEnd = Math.min(len, offset + gapHalf);
                corridorElement.gaps.push({
                    start: gapStart,
                    end: gapEnd
                });
                elements.push({
                    type: 'door',
                    x: prev.x,
                    y: prev.y,
                    angle,
                    offset,
                    side,
                    thickness: wallThickness,
                    gapStart,
                    gapEnd
                });
            }

        }

        for (let i = 1; i < vertices.length - 1; i++) {
            const prev = vertices[i - 1];
            const current = vertices[i];
            const next = vertices[i + 1];
            const a1 = Math.atan2(current.y - prev.y, current.x - prev.x);
            const a2 = Math.atan2(next.y - current.y, next.x - current.x);
            let delta = a2 - a1;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            if (Math.abs(delta) < 0.15) continue;
            elements.push({
                type: 'turn',
                x: current.x,
                y: current.y,
                angle: a2,
                thickness: wallThickness,
                direction: delta > 0 ? 1 : -1
            });
        }

        return elements;
    }

    function drawFloorPlan() {
        if (!floorPlanElements.length) return;
        p.push();
        p.scale(0.9);
        p.rectMode(p.CORNER);
        p.noFill();
        for (const element of floorPlanElements) {
            switch (element.type) {
                case 'corridor':
                    drawCorridor(element);
                    break;
                case 'door':
                    drawDoor(element);
                    break;
                case 'turn':
                    drawTurnJoint(element);
                    break;
            }
        }
        p.pop();
    }

    function drawCorridor(seg) {
        p.push();
        p.translate(seg.x, seg.y);
        p.rotate(seg.angle);
        p.stroke(0);
        p.strokeWeight(1.8);
        const segments = computeCorridorSegments(seg);
        for (const range of segments) {
            drawCorridorRange(range.start, range.end, seg.dashed);
        }
        p.pop();
    }

    function computeCorridorSegments(seg) {
        const segments = [];
        const totalLen = seg.len;
        const gaps = Array.isArray(seg.gaps) ? [...seg.gaps] : [];
        gaps.sort((a, b) => a.start - b.start);
        let cursor = 0;
        for (const gap of gaps) {
            const start = Math.max(0, Math.min(totalLen, gap.start));
            const end = Math.max(0, Math.min(totalLen, gap.end));
            if (start > cursor) {
                segments.push({
                    start: cursor,
                    end: start
                });
            }
            cursor = Math.max(cursor, end);
        }
        if (cursor < totalLen) {
            segments.push({
                start: cursor,
                end: totalLen
            });
        }
        return segments;
    }

    function drawCorridorRange(start, end, dashed) {
        if (end - start <= 0.5) return;
        if (dashed) {
            const dashLen = 6;
            const gap = 18;
            for (let dist = start; dist < end; dist += dashLen + gap) {
                const dashEnd = Math.min(end, dist + dashLen);
                p.line(dist, 0, dashEnd, 0);
            }
        } else {
            p.line(start, 0, end, 0);
        }
    }

    function drawDoor(door) {
        p.push();
        p.translate(door.x, door.y);
        p.rotate(door.angle);
        p.translate(door.offset, 0);
        const dir = door.side > 0 ? 1 : -1;
        const reach = door.thickness / 2;
        p.stroke(0);
        p.strokeWeight(2);
        p.line(0, 0, 0, dir * reach);
        p.noFill();
        const startAngle = dir > 0 ? Math.PI * 1.5 : Math.PI;
        const endAngle = dir > 0 ? Math.PI * 2 : Math.PI * 1.5;
        p.arc(0, dir * reach, reach * 2, reach * 2, startAngle, endAngle);
        p.pop();
    }

    function drawTurnJoint(turn) {
        p.push();
        p.translate(turn.x, turn.y);
        p.rotate(turn.angle - turn.direction * p.HALF_PI);
        const length = 14;
        p.stroke(0);
        p.strokeWeight(1.3);
        p.line(-length, 0, 0, 0);
        p.line(0, 0, 0, length * turn.direction);
        p.pop();
    }

    p.mousePressed = function() {
        offsetX = p.mouseX - centerX;
        offsetY = p.mouseY - centerY;
    }
    p.keyReleased = function() {
        if (isFormFieldFocused()) return true;
        if (p.keyCode === p.ALT) {
            actRandomSeed++;
            p.setup();
        }
    }

    p.keyPressed = function() {
        if (isFormFieldFocused()) return true;
        let changed = false;
        switch (p.keyCode) {
            case p.DELETE:
            case p.BACKSPACE:
                if (userText.length > lockedExtraLength) {
                    userText = userText.slice(0, userText.length - 1);
                    clampLockedExtraLength();
                    changed = true;
                }
                break;
            case p.ENTER:
            case p.RETURN:
                userText += TURN_MARKER;
                changed = true;
                break;
            case p.UP_ARROW:
                zoom += 0.05;
                break;
            case p.DOWN_ARROW:
                zoom -= 0.05;
                break;
        }
        if (changed) {
            handleLocalTextChange();
            return false;
        }
    }

    p.keyTyped = function() {
        if (isFormFieldFocused()) return true;
        if (typeof p.key === 'string' && p.key.length === 1 && p.key !== '\r' && p.key !== '\n') {
            userText += p.key;
            handleLocalTextChange();
        }
        return false;
    }

    // 창 크기가 변경될 때 캔버스 크기 자동 조절
    p.windowResized = function() {
        resizeCanvasForLayout();
    }

    function ensureFirebaseSync() {
        if (firebaseInitialized) return;
        if (typeof firebase === 'undefined') {
            console.warn('[Firebase] SDK를 찾을 수 없어 로컬 모드로 실행됩니다.');
            return;
        }

        const config = window.firebaseProjectConfig;
        const hasValidConfig = config && typeof config === 'object' &&
            Object.values(config).every(value => typeof value === 'string' && !value.startsWith('REPLACE_WITH'));
        if (!hasValidConfig) {
            console.warn('[Firebase] firebase-config.js를 실제 프로젝트 설정으로 업데이트하세요.');
            return;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(config);
            }
        } catch (error) {
            console.error('[Firebase] 초기화 실패', error);
            return;
        }

        firebaseDocRef = firebase.firestore().collection(FIREBASE_COLLECTION).doc(FIREBASE_DOCUMENT_ID);
        firebaseDocRef.onSnapshot(handleRemoteSnapshot, (error) => console.error('[Firebase] snapshot error', error));
        firebaseInitialized = true;
    }

    function handleRemoteSnapshot(doc) {
        if (!doc.exists) {
            queueSaveToFirebase(true);
            return;
        }
        const data = doc.data() || {};
        let remoteExtra;
        if (typeof data.extraText === 'string') {
            remoteExtra = data.extraText;
        } else if (typeof data.text === 'string') {
            if (data.text.startsWith(defaultText)) {
                const suffix = data.text.slice(defaultText.length);
                remoteExtra = suffix.startsWith(TURN_MARKER) ? suffix.slice(1) : suffix;
            } else {
                remoteExtra = data.text;
            }
        }
        if (typeof remoteExtra === 'undefined') {
            queueSaveToFirebase(true);
            return;
        }
        if (remoteExtra === userText) return;

        const previousUserText = userText;
        const lockedPrefixLength = Math.min(lockedExtraLength, previousUserText.length);
        const editableSuffix = previousUserText.slice(lockedPrefixLength);

        isApplyingRemoteUpdate = true;
        userText = remoteExtra;
        if (editableSuffix && typeof remoteExtra === 'string' && remoteExtra.endsWith(editableSuffix)) {
            lockedExtraLength = Math.max(0, remoteExtra.length - editableSuffix.length);
        } else {
            lockedExtraLength = typeof remoteExtra === 'string' ? remoteExtra.length : 0;
        }
        clampLockedExtraLength();
        refreshTextAndPaths();
        isApplyingRemoteUpdate = false;
    }

    function queueSaveToFirebase(immediate = false) {
        if (!firebaseDocRef || isApplyingRemoteUpdate) return;
        const persist = () => {
            firebaseDocRef.set({
                text: textTyped,
                extraText: userText,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, {
                merge: true
            }).catch((error) => console.error('[Firebase] 저장 실패', error));
        };

        if (immediate) {
            persist();
            return;
        }

        if (firebaseSaveTimer) clearTimeout(firebaseSaveTimer);
        firebaseSaveTimer = setTimeout(persist, 150);
    }
};

// ✨ 중요: 인스턴스 모드로 작성된 스케치를 실행시키는 코드입니다.
new p5(wordMapSketch);

'use strict';

const wordMapSketch = function(p) {
    const wordData = {
        objects: ['Pillow', 'Blanket', 'Cup', 'Diary', 'Photos', 'Furniture', 'Window', 'Desk', 'Laptop', 'people'],
        actions: ['songs', 'Cleaning', 'Sleep', 'Lying-down', 'Cook', 'smell']
    };

    let textTyped = '';
    let centerX, centerY, offsetX, offsetY, zoom;
    let actRandomSeed;
    let colors = [];
    let pathCommands = [];

    p.setup = function() {
        p.createCanvas(p.windowWidth, p.windowHeight);
        colors = [
            p.color(230, 57, 70), p.color(241, 196, 15), p.color(29, 131, 225),
            p.color(106, 77, 153), p.color(69, 179, 157), p.color(243, 156, 18)
        ];
        if (textTyped === '') {
            textTyped = wordData.objects.join(' ') + ' ' + wordData.actions.join(' ');
        }
        actRandomSeed = p.floor(p.random(1000));
        p.textFont('monospace', 25);
        p.textAlign(p.LEFT, p.BASELINE);

        // ✨ 경로를 미리 생성
        pathCommands = generatePathCommands();

        // ✨ 시작점을 좌측 상단으로 변경하고 줌 레벨을 1.0으로 고정
        centerX = 500; // 좌측 여백
        centerY = 400; // 상단 여백
        zoom = 1.0;

        offsetX = 0;
        offsetY = 0;
        p.cursor(p.HAND);
    };

    p.draw = function() {
        p.background(255);
        if (p.mouseIsPressed && p.mouseButton === p.LEFT) {
            centerX = p.mouseX - offsetX;
            centerY = p.mouseY - offsetY;
        }

        p.push();
        p.translate(centerX, centerY);
        p.scale(zoom);

        // 미리 계산된 명령어들을 순서대로 실행하여 그리기
        for (const cmd of pathCommands) {
            p.noStroke();
            if (cmd.type === 'char') {
                p.fill(0);
                p.text(cmd.value, 0, 0);
                p.translate(p.textWidth(cmd.value), 0);
            } else if (cmd.type === 'turn') {
                p.fill(cmd.color);
                drawJoint(cmd.degrees, cmd.direction);
            }
        }

        p.fill(0);
        if (p.frameCount / 12 % 2 < 1) p.rect(0, -10, 8, 1.5);
        p.pop();
    };

    function drawJoint(turnDegrees, direction) {
        const radius = 12;
        const angle = p.radians(turnDegrees) * direction;
        p.beginShape();
        p.vertex(0, 0);
        for (let a = 0; p.abs(a) <= p.abs(angle); a += p.radians(5)) {
            let x = radius * p.cos(a * direction);
            let y = radius * p.sin(a * direction);
            p.vertex(x, y);
        }
        p.endShape(p.CLOSE);
        p.rotate(angle);
    }

    // ✨ --- START: 겹침 방지 경로를 생성하는 새로운 핵심 함수 --- ✨
    function generatePathCommands() {
        const commands = [];
        let x = 0,
            y = 0,
            angle = 0;

        const gridSize = 25; // 격자 크기
        const visitedCells = new Set();
        visitedCells.add('0,0');

        p.randomSeed(actRandomSeed);
        let colorIndex = 0;

        for (let i = 0; i < textTyped.length; i++) {
            const letter = textTyped.charAt(i);
            if (letter === ' ') {
                const currentCellX = p.round(x / gridSize);
                const currentCellY = p.round(y / gridSize);

                const potentialTurns = [{
                        degrees: 90,
                        direction: 1
                    }, // 오른쪽 90도
                    {
                        degrees: 90,
                        direction: -1
                    }, // 왼쪽 90도
                ];

                let availableTurns = [];
                // 현재 각도를 기준으로 갈 수 있는 방향 (앞, 왼쪽, 오른쪽) 확인
                for (const turn of potentialTurns) {
                    const nextAngle = angle + p.radians(turn.degrees * turn.direction);
                    const nextCellX = currentCellX + p.round(p.cos(nextAngle));
                    const nextCellY = currentCellY + p.round(p.sin(nextAngle));

                    if (!visitedCells.has(`${nextCellX},${nextCellY}`)) {
                        availableTurns.push(turn);
                    }
                }

                let chosenTurn;
                if (availableTurns.length > 0) {
                    chosenTurn = p.random(availableTurns);
                } else {
                    // 막다른 길이면 180도 회전하여 빠져나옴
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

                // 시뮬레이션: 각도만 업데이트 (실제 그리기는 drawJoint에서)
                angle += p.radians(chosenTurn.degrees * chosenTurn.direction);

            } else if (letter !== '\n') {
                commands.push({
                    type: 'char',
                    value: letter
                });
                // 시뮬레이션: 텍스트 너비만큼 앞으로 이동
                x += p.cos(angle) * p.textWidth(letter);
                y += p.sin(angle) * p.textWidth(letter);
            }

            // 경로의 현재 위치를 격자 칸에 기록
            const cellX = p.round(x / gridSize);
            const cellY = p.round(y / gridSize);
            visitedCells.add(`${cellX},${cellY}`);
        }

        return commands;
    }
    // ✨ --- END: 새로운 핵심 함수 --- ✨

    p.mousePressed = function() {
        offsetX = p.mouseX - centerX;
        offsetY = p.mouseY - centerY;
    }
    p.keyReleased = function() {
        if (p.keyCode === p.ALT) {
            actRandomSeed++;
            p.setup();
        }
    }

    p.keyPressed = function() {
        switch (p.keyCode) {
            case p.DELETE:
            case p.BACKSPACE:
                textTyped = textTyped.slice(0, -1);
                pathCommands = generatePathCommands(); // 경로 다시 생성
                break;
            case p.ENTER:
            case p.RETURN:
                break;
            case p.UP_ARROW:
                zoom += 0.05;
                break;
            case p.DOWN_ARROW:
                zoom -= 0.05;
                break;
        }
        if (p.keyCode === 32) { // 스페이스바
            textTyped += ' ';
            pathCommands = generatePathCommands(); // 경로 다시 생성
            return false;
        }
    }

    p.keyTyped = function() {
        if (p.key !== ' ') {
            textTyped += p.key;
            pathCommands = generatePathCommands(); // 경로 다시 생성
        }
        return false;
    }

    // 창 크기가 변경될 때 캔버스 크기 자동 조절
    p.windowResized = function() {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
    }
};

// ✨ 중요: 인스턴스 모드로 작성된 스케치를 실행시키는 코드입니다.
new p5(wordMapSketch);
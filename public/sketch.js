'use strict';

const wordMapSketch = function(p) {
    let socket;
    let myData = {
        text: '',
        x: 0,
        y: 0,
        seed: 0
    };
    
    // 다른 플레이어들의 정보를 저장할 객체
    let otherPlayers = {};

    const wordData = {
        objects: ['Pillow', 'Blanket', 'Cup', 'Diary', 'Photos', 'Furniture', 'Window', 'Desk', 'Laptop', 'people'],
        actions: ['songs', 'Cleaning', 'Sleep', 'Lying-down', 'Cook', 'smell']
    };

    let centerX, centerY, offsetX, offsetY, zoom;
    let colors = [];

    p.setup = function() {
        p.createCanvas(p.windowWidth, p.windowHeight);
        
        // 1. 소켓 연결 시작
        socket = io();

        colors = [
            p.color(230, 57, 70), p.color(241, 196, 15), p.color(29, 131, 225),
            p.color(106, 77, 153), p.color(69, 179, 157), p.color(243, 156, 18)
        ];

        // 초기 내 데이터 설정
    myData.text = wordData.objects.join(' ') + ' ' + wordData.actions.join(' ');
        
        myData.seed = p.floor(p.random(1000));
        
        p.textFont('monospace', 25);
        p.textAlign(p.LEFT, p.BASELINE);
        
        centerX = p.width / 2;
        centerY = p.height / 2;
        zoom = 1.0;
        offsetX = 0;
        offsetY = 0;
        p.cursor(p.HAND);

        // --- 소켓 이벤트 리스너 ---
        
        // 1. 현재 접속 중인 다른 플레이어들 정보 받기
        socket.on('currentPlayers', (players) => {
            otherPlayers = players;
            // 내 ID에 해당하는 정보는 제외 (로컬에서 관리하므로)
            delete otherPlayers[socket.id];
        });

        // 2. 새로운 플레이어 입장
        socket.on('newPlayer', (pInfo) => {
            otherPlayers[pInfo.id] = pInfo.data;
        });

        // 3. 다른 플레이어 정보 업데이트 (글자 쓰거나 이동 시)
        socket.on('playerUpdated', (pInfo) => {
            otherPlayers[pInfo.id] = pInfo.data;
        });

        // 4. 플레이어 퇴장
        socket.on('playerDisconnected', (id) => {
            delete otherPlayers[id];
        });

        // 내 초기 정보 서버로 전송
        sendUpdate();
    };

    p.draw = function() {
        p.background(255);

        // 마우스 드래그로 화면 이동 (카메라 이동)
        if (p.mouseIsPressed && p.mouseButton === p.LEFT) {
            centerX = p.mouseX - offsetX;
            centerY = p.mouseY - offsetY;
        }

        p.push();
        p.translate(centerX, centerY);
        p.scale(zoom);

        // A. 다른 플레이어들 그리기
        for (let id in otherPlayers) {
            let player = otherPlayers[id];
            // 다른 사람은 반투명하게 그려서 구분
            p.push();
            // 다른 사람의 위치 기준 (상대적 위치라면 계산 필요, 여기서는 일단 원점 기준)
            // 만약 개별 위치를 갖고 싶다면 player.x, player.y를 사용
            drawSnake(player.text, player.seed, 100); // 투명도 100
            p.pop();
        }

        // B. 나 그리기 (가장 선명하게, 맨 위에)
        drawSnake(myData.text, myData.seed, 255);

        p.pop();
    };

    // 🐍 뱀을 그리는 함수 (내 것과 남의 것을 모두 그리기 위해 분리함)
    function drawSnake(txt, seed, alphaVal) {
        // 경로 계산 (이전의 generatePathCommands 로직을 여기로 통합)
        const commands = generatePathCommandsForText(txt, seed);
        
        p.push();
        // 필요하다면 여기서 translate(x, y)를 할 수 있음
        for (const cmd of commands) {
            p.noStroke();
            if (cmd.type === 'char') {
                p.fill(0, alphaVal); // 검정색 + 투명도
                p.text(cmd.value, 0, 0);
                p.translate(p.textWidth(cmd.value), 0);
            } else if (cmd.type === 'turn') {
                // 색상에 투명도 적용
                let c = cmd.color;
                p.fill(p.red(c), p.green(c), p.blue(c), alphaVal);
                drawJoint(cmd.degrees, cmd.direction);
            }
        }
        p.pop();
    }

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
    
    // 경로 생성 로직 (파라미터화)
    function generatePathCommandsForText(txt, seed) {
        const commands = [];
        let x = 0, y = 0, angle = 0;
        const gridSize = 25;
        const visitedCells = new Set();
        visitedCells.add('0,0');
        
        p.randomSeed(seed); // 플레이어 고유의 시드값 사용
        let colorIndex = 0;

        for (let i = 0; i < txt.length; i++) {
            const letter = txt.charAt(i);
            if (letter === ' ') {
                const currentCellX = p.round(x / gridSize);
                const currentCellY = p.round(y / gridSize);
                const potentialTurns = [
                    { degrees: 90, direction: 1 },
                    { degrees: 90, direction: -1 },
                ];
                let availableTurns = [];
                for (const turn of potentialTurns) {
                    const nextAngle = angle + p.radians(turn.degrees * turn.direction);
                    const nextCellX = currentCellX + p.round(p.cos(nextAngle));
                    const nextCellY = currentCellY + p.round(p.sin(nextAngle));
                    if (!visitedCells.has(`${nextCellX},${nextCellY}`)) availableTurns.push(turn);
                }
                let chosenTurn;
                if (availableTurns.length > 0) chosenTurn = p.random(availableTurns);
                else chosenTurn = { degrees: 180, direction: 1 };

                commands.push({
                    type: 'turn',
                    degrees: chosenTurn.degrees,
                    direction: chosenTurn.direction,
                    color: colors[colorIndex]
                });
                colorIndex = (colorIndex + 1) % colors.length;
                angle += p.radians(chosenTurn.degrees * chosenTurn.direction);
            } else {
                commands.push({ type: 'char', value: letter });
                x += p.cos(angle) * p.textWidth(letter);
                y += p.sin(angle) * p.textWidth(letter);
            }
            const cellX = p.round(x / gridSize);
            const cellY = p.round(y / gridSize);
            visitedCells.add(`${cellX},${cellY}`);
        }
        return commands;
    }

    // 서버에 내 데이터 변경 알림
    function sendUpdate() {
        socket.emit('updateData', myData);
    }

    p.mousePressed = function() { offsetX = p.mouseX - centerX; offsetY = p.mouseY - centerY; }
    
    p.keyReleased = function() { 
        if (p.keyCode === p.ALT) { 
            myData.seed++; 
            sendUpdate(); 
        } 
    }
    
    p.keyPressed = function() {
        let changed = false;
        switch (p.keyCode) {
            case p.DELETE: case p.BACKSPACE:
                myData.text = myData.text.slice(0, -1);
                changed = true;
                break;
            case p.ENTER: case p.RETURN: break;
            case p.UP_ARROW: zoom += 0.05; break;
            case p.DOWN_ARROW: zoom -= 0.05; break;
        }
        if (p.keyCode === 32) { // Space
            myData.text += ' ';
            changed = true;
        }
        if (changed) sendUpdate();
    }

    p.keyTyped = function() {
        if (p.key !== ' ' && p.key !== 'Enter') {
            myData.text += p.key;
            sendUpdate();
        }
        return false;
    }

    p.windowResized = function() { p.resizeCanvas(p.windowWidth, p.windowHeight); }
};

new p5(wordMapSketch);
setTimeout(() => {
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
}, 4500);

const vehicleData = {
    compact: { type: 'compact', w: 1.8, h: 1.5, l: 3.5, accel: 0.005, maxSpeed: 0.30, color: 0xffff00 },
    sedan:   { type: 'sedan', w: 2.0, h: 1.4, l: 4.5, accel: 0.004, maxSpeed: 0.35, color: 0x0088ff },
    truck:   { type: 'truck', w: 2.6, h: 2.5, l: 6.5, accel: 0.003, maxSpeed: 0.25, color: 0xff3333 }
};

let currentVehicle = null;
let currentDifficulty = 'EASY';

function updateDifficultyUI() {
    const mediumUnlocked = localStorage.getItem('unlocked_MEDIUM') === 'true';
    const difficultUnlocked = localStorage.getItem('unlocked_DIFFICULT') === 'true';

    const btnMedium = document.querySelector('.menu-btn.medium');
    const btnDifficult = document.querySelector('.menu-btn.difficult');

    if (btnMedium) {
        if (mediumUnlocked) {
            btnMedium.classList.remove('locked');
            btnMedium.disabled = false;
        } else {
            btnMedium.classList.add('locked');
            btnMedium.disabled = true;
        }
    }

    if (btnDifficult) {
        if (difficultUnlocked) {
            btnDifficult.classList.remove('locked');
            btnDifficult.disabled = false;
        } else {
            btnDifficult.classList.add('locked');
            btnDifficult.disabled = true;
        }
    }
}

function selectVehicle(type) {
    currentVehicle = vehicleData[type];
    document.getElementById('vehicle-selection').classList.add('hidden');
    document.getElementById('difficulty-selection').classList.remove('hidden');
    document.getElementById('selected-vehicle-text').innerText = "VEHICLE: " + type.toUpperCase();
    updateDifficultyUI();
}

function backToVehicle() {
    document.getElementById('difficulty-selection').classList.add('hidden');
    document.getElementById('vehicle-selection').classList.remove('hidden');
}

// --- 게임 상태 변수 ---
let isGameOver = false;
let timerValue = 0;
let timerInterval;

// 물리 상태
let carPhysics = { x: 0, z: 0, speed: 0, angle: 0 };
let walls = [];
let parkingSpot = { x: 0, z: 0, w: 3.5, l: 6.0 };

// 컨트롤
const controls = { gas: false, brake: false, left: false, right: false };

// --- Three.js 핵심 변수 ---
let scene, camera, renderer;
let ambientLight, dirLight;
let carGroup;
let animationId;
let envObjects = []; // 애니메이션 환경 물체들

// 초기 셋업
function initThreeJS() {
    const container = document.getElementById('canvas-container');
    container.innerHTML = ''; // 기존 캔버스 제거

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 하늘색 배경
    scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 조명 세팅 (전역 변수 재할당)
    ambientLight = new THREE.AmbientLight(0x404040, 1.5); // 부드러운 환경광
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(20, 50, -20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    scene.add(dirLight);

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

function buildMap(difficulty) {
    // 1. 다이내믹 3D 테마(Theme) 설정
    let floorColor = 0x333333; // 기본 아스팔트
    let wallColor = 0x888888; // 콘크리트 회색
    let bgColor = 0x87CEEB; // 하늘색
    let fogDensity = 150;
    let ambientColor = 0x404040;
    let dirColor = 0xffffff;
    let spotColor = 0x00ff00; // 목적지 하이라이트 색상

    if (difficulty === 'EASY') {
        // 평화로운 숲 (EASY)
        floorColor = 0x2e4a11; // 푸른 잔디
        wallColor = 0x5c3a21; // 우드톤 (나무 벽)
        bgColor = 0xa0d8ef; // 청명한 하늘
        ambientColor = 0x666666;
        dirColor = 0xfff5cc; // 따뜻한 햇살
        fogDensity = 120; // 쾌적한 시야
    } else if (difficulty === 'MEDIUM') {
        // 야간 네온 시티 (MEDIUM)
        floorColor = 0x111111; // 짙은 아스팔트
        wallColor = 0x1c2b39; // 차가운 푸른빛이 감도는 벽
        bgColor = 0x050510; // 밤하늘
        ambientColor = 0x303050; // 야간이지만 맵 전체가 잘 보이도록 밝기 상향
        dirColor = 0x88aaff; // 푸르고 밝은 달빛
        fogDensity = 100; // 시야를 해치지 않는 선의 야간 안개
    } else if (difficulty === 'DIFFICULT') {
        // 지옥의 용암 지대 (DIFFICULT)
        floorColor = 0x220500; // 검게 그을린 바닥 (마그마)
        wallColor = 0x1a0a05; // 어두운 화성암 바위
        bgColor = 0x330000; // 피보라 치는 하늘색
        ambientColor = 0x602020; // 붉은 환경광을 밝게 올려서 맵 식별 용이하게
        dirColor = 0xff5522; // 강렬하고 밝은 붉은 화염 조명
        fogDensity = 80; // 긴장감을 주되 운전에 방해되지 않는 안개
        spotColor = 0xffff00; // 어두운 붉은 맵에서 눈에 띄도록 형광 노란색 목적지
    }

    // 테마 환경색 즉시 적용
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.Fog(bgColor, 10, fogDensity);
    ambientLight.color.setHex(ambientColor);
    dirLight.color.setHex(dirColor);

    // 바닥 생성 (테마 컬러 적용)
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    walls = [];
    
    // 벽 생성 헬퍼 함수
    function addWall(x, z, w, l) {
        const geo = new THREE.BoxGeometry(w, 2, l);
        const mat = new THREE.MeshStandardMaterial({ color: wallColor });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 1, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        walls.push({ x: x - w/2, z: z - l/2, w: w, l: l }); // 충돌용 AABB
    }

    // 외곽선
    addWall(0, -50, 100, 2);
    addWall(0, 50, 100, 2);
    addWall(-50, 0, 2, 100);
    addWall(50, 0, 2, 100);

    // 난이도별 맵과 시간
    switch(difficulty) {
        case 'EASY':
            timerValue = 40;
            parkingSpot = { x: 0, z: -30, w: 4, l: 8 };
            // 장애물 조금
            addWall(-10, -10, 5, 20);
            addWall(15, 10, 10, 5);
            break;
        case 'MEDIUM':
            timerValue = 30;
            parkingSpot = { x: 20, z: -30, w: 3.5, l: 7 };
            // 미로처럼 구성
            addWall(0, -15, 40, 2);
            addWall(-15, 10, 2, 30);
            addWall(15, 15, 20, 2);
            addWall(25, -20, 2, 20);
            addWall(15, -30, 2, 8); // 주차장 옆 벽
            addWall(25, -30, 2, 8); // 주차장 옆 벽
            break;
        case 'DIFFICULT':
            timerValue = 25; // 트럭이면 극악의 난이도
            parkingSpot = { x: 40, z: -40, w: 3, l: 7 }; // 좁음
            // 복잡한 주차장 (차량들이 빽빽하게 주차된 느낌)
            for(let i=-40; i<40; i+=10) {
                if(i !== 0) addWall(i, -20, 4, 8);
                if(i !== 40) addWall(i, -40, 4, 8); // 주차 공간 빼고 채움
            }
            addWall(0, 0, 80, 2);
            addWall(-30, 20, 5, 20);
            addWall(20, 30, 30, 5);
            break;
    }

    // 주차 공간 하이라이트 (테마별 목적지 색상 적용)
    const spotGeo = new THREE.PlaneGeometry(parkingSpot.w, parkingSpot.l);
    const spotMat = new THREE.MeshBasicMaterial({ color: spotColor, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    parkingSpotMesh = new THREE.Mesh(spotGeo, spotMat);
    parkingSpotMesh.rotation.x = -Math.PI / 2;
    parkingSpotMesh.position.set(parkingSpot.x, 0.05, parkingSpot.z);
    scene.add(parkingSpotMesh);

    // 차량 초기 위치 설정
    carPhysics.x = 0;
    carPhysics.z = 10;
    carPhysics.speed = 0;
    carPhysics.angle = Math.PI; // 북쪽 바라봄

    createEnvironment(difficulty); // 테마별 3D 지형지물 렌더링
}

// --- 생동감 넘치는 3D 지형지물 (Procedural Generation) ---
function createEnvironment(difficulty) {
    // 기존 환경 오브젝트 제거
    envObjects.forEach(obj => scene.remove(obj.mesh));
    envObjects = [];

    // 외곽(안전구역)에만 오브젝트를 배치하여 주행 방해 방지
    const safePositions = [];
    for (let i = 0; i < 60; i++) {
        let px = (Math.random() - 0.5) * 120;
        let pz = (Math.random() - 0.5) * 120;
        // 주차장 중심부(반경 40) 이내에는 렌더링하지 않음
        if (Math.abs(px) < 40 && Math.abs(pz) < 40) continue;
        safePositions.push({ x: px, z: pz });
    }

    if (difficulty === 'EASY') {
        // [숲 테마] - 나무 생성
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 3, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21 });
        const leafGeo = new THREE.ConeGeometry(2, 5, 8);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });

        safePositions.forEach(pos => {
            const tree = new THREE.Group();
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1.5;
            const leaves = new THREE.Mesh(leafGeo, leafMat);
            leaves.position.y = 4.5;
            tree.add(trunk);
            tree.add(leaves);
            tree.position.set(pos.x, 0, pos.z);
            scene.add(tree);
            // 가만히 있는 나무도 리스트에 넣음 (필요 시 바람 애니메이션 추가 가능)
            envObjects.push({ mesh: tree, type: 'static' });
        });

    } else if (difficulty === 'MEDIUM') {
        // [야간 도시 테마] - 가로등과 깜빡이는 네온사인
        const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 8, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const bulbGeo = new THREE.SphereGeometry(0.5, 8, 8);
        
        safePositions.forEach((pos, index) => {
            if (index % 2 === 0) {
                // 가로등
                const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.y = 4;
                const bulb = new THREE.Mesh(bulbGeo, lightMat);
                bulb.position.y = 8;
                const lamp = new THREE.Group();
                lamp.add(pole);
                lamp.add(bulb);
                lamp.position.set(pos.x, 0, pos.z);
                scene.add(lamp);
                envObjects.push({ mesh: lamp, type: 'static' });
            } else {
                // 네온사인 박스 (공중에 떠 있음)
                const neonColor = Math.random() > 0.5 ? 0x00ffff : 0xff00ff;
                const neonGeo = new THREE.BoxGeometry(2, 2, 2);
                const neonMat = new THREE.MeshBasicMaterial({ color: neonColor });
                const neonBox = new THREE.Mesh(neonGeo, neonMat);
                neonBox.position.set(pos.x, Math.random() * 5 + 3, pos.z);
                neonBox.rotation.y = Math.random() * Math.PI;
                scene.add(neonBox);
                envObjects.push({ mesh: neonBox, type: 'neon', baseColor: neonColor, timeOffset: Math.random() * 10 });
            }
        });

    } else if (difficulty === 'DIFFICULT') {
        // [용암 지대 테마] - 타오르는 화염 파티클과 떠다니는 용암석
        const rockGeo = new THREE.DodecahedronGeometry(2);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x110500, roughness: 1.0 });
        const fireGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        
        // 용암석
        safePositions.slice(0, 15).forEach(pos => {
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(pos.x, Math.random() * 2, pos.z);
            scene.add(rock);
            envObjects.push({ mesh: rock, type: 'rock', phase: Math.random() * Math.PI * 2 });
        });

        // 화염 파티클 (맵 전체에 무작위 분산)
        for(let i = 0; i < 80; i++) {
            const fireMat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff3300 : 0xffaa00 });
            const fire = new THREE.Mesh(fireGeo, fireMat);
            let fx = (Math.random() - 0.5) * 100;
            let fz = (Math.random() - 0.5) * 100;
            fire.position.set(fx, Math.random() * 10, fz);
            scene.add(fire);
            envObjects.push({ mesh: fire, type: 'fire', speedY: Math.random() * 0.1 + 0.05, speedRot: Math.random() * 0.1 });
        }
    }
}

function updateEnvironment() {
    const time = Date.now() * 0.003;
    envObjects.forEach(obj => {
        if (obj.type === 'neon') {
            // 네온사인 깜빡임 효과 (Blinking)
            const intensity = (Math.sin(time * 3 + obj.timeOffset) + 1) / 2;
            obj.mesh.material.color.setHex(intensity > 0.3 ? obj.baseColor : 0x111111);
        } else if (obj.type === 'rock') {
            // 용암석 둥둥 떠다니는 효과
            obj.mesh.position.y = Math.sin(time + obj.phase) * 1.5 + 2;
            obj.mesh.rotation.x += 0.01;
            obj.mesh.rotation.y += 0.01;
        } else if (obj.type === 'fire') {
            // 화염 파티클 위로 솟구치는 효과
            obj.mesh.position.y += obj.speedY;
            obj.mesh.rotation.x += obj.speedRot;
            obj.mesh.rotation.y += obj.speedRot;
            // 위로 너무 올라가면 바닥으로 다시 리스폰
            if (obj.mesh.position.y > 15) {
                obj.mesh.position.y = -1;
                obj.mesh.position.x = (Math.random() - 0.5) * 100;
                obj.mesh.position.z = (Math.random() - 0.5) * 100;
            }
        }
    });
}

let wheelMeshes = [];
let frontWheelGroups = [];

function createCar() {
    carGroup = new THREE.Group();
    wheelMeshes = [];
    frontWheelGroups = [];
    const v = currentVehicle;
    
    // 초고급 유리알 광택 페인트 재질 (MeshPhysicalMaterial)
    const paintMat = new THREE.MeshPhysicalMaterial({ 
        color: v.color, 
        clearcoat: 1.0, 
        clearcoatRoughness: 0.1, 
        metalness: 0.6, 
        roughness: 0.3 
    });
    // 반투명한 틴팅 유리 재질
    const glassMat = new THREE.MeshPhysicalMaterial({ 
        color: 0x111115, 
        metalness: 0.9, 
        roughness: 0.1,
        transmission: 0.5,
        transparent: true
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.2 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    const wheelY = 0.4;
    const chassisY = 0.8;
    
    // 차체 뼈대 (Chassis)
    const chassisGeo = new THREE.BoxGeometry(v.w, v.h * 0.3, v.l);
    const chassis = new THREE.Mesh(chassisGeo, paintMat);
    chassis.position.y = chassisY;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    carGroup.add(chassis);

    // 하단 다크 범퍼 립 (Bumper Lip)
    const lipGeo = new THREE.BoxGeometry(v.w * 1.05, 0.1, v.l * 1.02);
    const lip = new THREE.Mesh(lipGeo, darkMat);
    lip.position.y = chassisY - (v.h * 0.15) - 0.05;
    carGroup.add(lip);

    // 탑승 공간 (Cabin) 및 유선형 디자인 처리
    const cabinW = v.w - 0.2;
    let cabinGeo, cabin, cabinZ = 0;
    
    if (v.type === 'compact') {
        cabinGeo = new THREE.BoxGeometry(cabinW, v.h * 0.55, v.l * 0.5);
        cabinZ = 0.4; // 해치백
        cabin = new THREE.Mesh(cabinGeo, glassMat);
        cabin.position.set(0, chassisY + (v.h * 0.4) + 0.1, cabinZ);
        
        // 해치백 비스듬한 앞유리
        const windshieldGeo = new THREE.BoxGeometry(cabinW, 0.1, v.l * 0.4);
        const windshield = new THREE.Mesh(windshieldGeo, glassMat);
        windshield.rotation.x = Math.PI / 6;
        windshield.position.set(0, cabin.position.y - 0.1, cabinZ - (v.l*0.25) - 0.2);
        carGroup.add(windshield);

    } else if (v.type === 'sedan') {
        cabinGeo = new THREE.BoxGeometry(cabinW, v.h * 0.45, v.l * 0.4);
        cabinZ = 0.2;
        cabin = new THREE.Mesh(cabinGeo, glassMat);
        cabin.position.set(0, chassisY + (v.h * 0.35) + 0.1, cabinZ);

        // 세단 유선형 앞유리
        const frontWind = new THREE.Mesh(new THREE.BoxGeometry(cabinW, 0.1, v.l * 0.3), glassMat);
        frontWind.rotation.x = Math.PI / 5;
        frontWind.position.set(0, cabin.position.y, cabinZ - (v.l*0.2) - 0.2);
        carGroup.add(frontWind);
        
        // 세단 유선형 뒷유리
        const rearWind = new THREE.Mesh(new THREE.BoxGeometry(cabinW, 0.1, v.l * 0.25), glassMat);
        rearWind.rotation.x = -Math.PI / 6;
        rearWind.position.set(0, cabin.position.y, cabinZ + (v.l*0.2) + 0.2);
        carGroup.add(rearWind);
        
        // 스포일러 (Rear Spoiler)
        const spoilerGeo = new THREE.BoxGeometry(v.w * 0.9, 0.05, 0.3);
        const spoiler = new THREE.Mesh(spoilerGeo, paintMat);
        spoiler.position.set(0, chassisY + (v.h*0.15) + 0.1, v.l / 2 - 0.1);
        
        const spoilerLegL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.1), darkMat);
        spoilerLegL.position.set(-0.6, chassisY + (v.h*0.15) + 0.05, v.l / 2 - 0.1);
        const spoilerLegR = spoilerLegL.clone();
        spoilerLegR.position.x = 0.6;
        
        carGroup.add(spoiler);
        carGroup.add(spoilerLegL);
        carGroup.add(spoilerLegR);

    } else if (v.type === 'truck') {
        cabinGeo = new THREE.BoxGeometry(v.w, v.h * 0.6, v.l * 0.35);
        cabinZ = -v.l/2 + (v.l*0.35)/2 + 0.2;
        cabin = new THREE.Mesh(cabinGeo, glassMat);
        cabin.position.set(0, chassisY + (v.h * 0.45), cabinZ);

        // 거대 크롬 그릴
        const grilleGeo = new THREE.BoxGeometry(v.w * 0.6, v.h * 0.4, 0.1);
        const grille = new THREE.Mesh(grilleGeo, chromeMat);
        grille.position.set(0, chassisY + 0.1, -v.l/2 - 0.05);
        carGroup.add(grille);

        // 거대 배기통 (Exhaust Stacks)
        const stackGeo = new THREE.CylinderGeometry(0.1, 0.1, v.h * 1.2, 16);
        const stackL = new THREE.Mesh(stackGeo, chromeMat);
        stackL.position.set(-v.w/2 - 0.1, chassisY + v.h*0.5, cabinZ + (v.l*0.35)/2);
        const stackR = stackL.clone();
        stackR.position.x = v.w/2 + 0.1;
        carGroup.add(stackL);
        carGroup.add(stackR);
        
        // 짐칸(Bed) 디테일
        const bedGeo = new THREE.BoxGeometry(v.w, 0.1, v.l * 0.6);
        const bed = new THREE.Mesh(bedGeo, darkMat);
        bed.position.set(0, chassisY + v.h * 0.15, v.l * 0.2);
        carGroup.add(bed);
        
        // 짐칸 사이드 월
        const wallGeo = new THREE.BoxGeometry(0.1, v.h * 0.3, v.l * 0.6);
        const wallL = new THREE.Mesh(wallGeo, paintMat);
        wallL.position.set(-v.w/2 + 0.05, chassisY + v.h * 0.3, v.l * 0.2);
        const wallR = wallL.clone();
        wallR.position.x = v.w/2 - 0.05;
        const wallB = new THREE.Mesh(new THREE.BoxGeometry(v.w, v.h * 0.3, 0.1), paintMat);
        wallB.position.set(0, chassisY + v.h * 0.3, v.l * 0.5 - 0.05);
        carGroup.add(wallL);
        carGroup.add(wallR);
        carGroup.add(wallB);
    }

    cabin.castShadow = true;
    carGroup.add(cabin);

    // 지붕 (Roof)
    const roofGeo = new THREE.BoxGeometry(cabinGeo.parameters.width + 0.05, 0.1, cabinGeo.parameters.depth + 0.05);
    const roof = new THREE.Mesh(roofGeo, paintMat);
    roof.position.set(0, cabin.position.y + cabinGeo.parameters.height/2 + 0.05, cabinZ);
    carGroup.add(roof);

    // 타이어 4개(트럭은 6개) 추가
    function addWheel(x, z, isFront) {
        // 조향용 축(Y축 회전)
        const steerGroup = new THREE.Group();
        steerGroup.position.set(x, wheelY, z);
        
        // 구동용 축(X축 회전)
        const rollGroup = new THREE.Group();
        
        const tireGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const tire = new THREE.Mesh(tireGeo, rubberMat);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        
        const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8);
        const rim = new THREE.Mesh(rimGeo, chromeMat);
        rim.rotation.z = Math.PI / 2;
        
        rollGroup.add(tire);
        rollGroup.add(rim);
        
        steerGroup.add(rollGroup);
        carGroup.add(steerGroup);
        
        wheelMeshes.push(rollGroup);
        if (isFront) frontWheelGroups.push(steerGroup);
    }

    const wx = v.w / 2;
    const wz = v.l / 2 - 0.8;
    addWheel(-wx, -wz, true); // 앞좌측
    addWheel(wx, -wz, true);  // 앞우측
    addWheel(-wx, wz, false);  // 뒤좌측
    addWheel(wx, wz, false);   // 뒤우측
    if(v.type === 'truck') {
        addWheel(-wx, wz - 1.2, false); // 트럭 추가 뒷바퀴
        addWheel(wx, wz - 1.2, false);
    }

    // 전면 헤드라이트
    const hw = 0.3, hh = 0.2;
    const hlGeo = new THREE.BoxGeometry(hw, hh, 0.1);
    const hlL = new THREE.Mesh(hlGeo, lightMat);
    hlL.position.set(-v.w/2 + 0.3, chassisY, -v.l/2 - 0.05);
    carGroup.add(hlL);
    
    const hlR = new THREE.Mesh(hlGeo, lightMat);
    hlR.position.set(v.w/2 - 0.3, chassisY, -v.l/2 - 0.05);
    carGroup.add(hlR);

    // 후미등 (테일램프)
    const tlGeo = new THREE.BoxGeometry(hw, hh, 0.1);
    const tlL = new THREE.Mesh(tlGeo, tailMat);
    tlL.position.set(-v.w/2 + 0.3, chassisY, v.l/2 + 0.05);
    carGroup.add(tlL);
    
    const tlR = new THREE.Mesh(tlGeo, tailMat);
    tlR.position.set(v.w/2 - 0.3, chassisY, v.l/2 + 0.05);
    carGroup.add(tlR);

    // 사이드미러
    const mirrorGeo = new THREE.BoxGeometry(0.2, 0.15, 0.15);
    const mirrorL = new THREE.Mesh(mirrorGeo, paintMat);
    mirrorL.position.set(-v.w/2 - 0.1, chassisY + 0.3, cabinZ - cabinGeo.parameters.depth/2 + 0.2);
    carGroup.add(mirrorL);
    
    const mirrorR = new THREE.Mesh(mirrorGeo, paintMat);
    mirrorR.position.set(v.w/2 + 0.1, chassisY + 0.3, cabinZ - cabinGeo.parameters.depth/2 + 0.2);
    carGroup.add(mirrorR);

    scene.add(carGroup);
}

// --- 물리 및 게임 로직 ---
function getCarCorners() {
    const cos = Math.cos(carPhysics.angle);
    const sin = Math.sin(carPhysics.angle);
    const w = currentVehicle.w / 2;
    const l = currentVehicle.l / 2;

    const offsets = [
        { dx: -w, dz: -l },
        { dx: w, dz: -l },
        { dx: w, dz: l },
        { dx: -w, dz: l }
    ];

    return offsets.map(p => ({
        x: carPhysics.x + (p.dx * cos + p.dz * sin),
        z: carPhysics.z + (-p.dx * sin + p.dz * cos)
    }));
}

function checkCollisions() {
    const corners = getCarCorners();
    
    // 벽(AABB)과 차량의 4개 꼭지점 충돌
    for(let wall of walls) {
        for(let corner of corners) {
            if(corner.x > wall.x && corner.x < wall.x + wall.w &&
               corner.z > wall.z && corner.z < wall.z + wall.l) {
                gameOver(false, "CRASHED!");
                return;
            }
        }
    }
}

function checkWinCondition() {
    // 주차 공간 중심점과의 거리 확인
    const dist = Math.hypot(carPhysics.x - parkingSpot.x, carPhysics.z - parkingSpot.z);
    
    // 주차장 각도는 0도이므로, 차도 0도 또는 180도 언저리여야 함 (주차선 정렬)
    const angleMod = Math.abs(carPhysics.angle % Math.PI);
    const isAligned = angleMod < 0.2 || angleMod > (Math.PI - 0.2);
    
    if(dist < 1.5 && isAligned && Math.abs(carPhysics.speed) < 0.05) {
        gameOver(true, "PARKING SUCCESS!");
    }
}

let steeringAngle = 0;
const maxSteering = 0.5; // 최대 조향각 (약 30도)
let isSteeringActive = false;

function updatePhysics() {
    if(isGameOver) return;
    const v = currentVehicle;

    // 키보드를 위한 기존의 조향각 조절 유지 및 핸들 복원력
    if (!isSteeringActive) {
        if (controls.left) {
            steeringAngle = Math.min(steeringAngle + 0.03, maxSteering);
        } else if (controls.right) {
            steeringAngle = Math.max(steeringAngle - 0.03, -maxSteering);
        } else {
            // 복원력 (핸들을 놓으면 자동으로 중앙으로 정렬)
            if (steeringAngle > 0) steeringAngle = Math.max(0, steeringAngle - 0.05);
            if (steeringAngle < 0) steeringAngle = Math.min(0, steeringAngle + 0.05);
        }
        
        // UI 핸들 시각적 동기화 (키보드 조작 시에도 핸들이 돌아가도록)
        const wheelUI = document.getElementById('steering-wheel');
        if (wheelUI) {
            const visualAngle = -(steeringAngle / maxSteering) * 120;
            wheelUI.style.transform = `rotate(${visualAngle}deg)`;
        }
    }

    // 가속 / 감속 페달 (아주 부드럽게 속도 증가)
    if(controls.gas) {
        carPhysics.speed += v.accel;
    } else if(controls.brake) {
        carPhysics.speed -= v.accel;
    } else {
        // 부드러운 자연 감속 (마찰력)
        carPhysics.speed *= 0.95;
        if (Math.abs(carPhysics.speed) < 0.001) carPhysics.speed = 0;
    }

    // 최대 속도 제한
    if(carPhysics.speed > v.maxSpeed) carPhysics.speed = v.maxSpeed;
    if(carPhysics.speed < -v.maxSpeed/2) carPhysics.speed = -v.maxSpeed/2;

    // 사실적인 조향 물리 (Ackermann Steering 근사치)
    // 차량이 이동할 때만 꺾인 바퀴 각도에 비례해서 차체가 회전함
    const wheelbase = v.l * 0.7; 
    if(Math.abs(carPhysics.speed) > 0.005) {
        const angularVelocity = (carPhysics.speed / wheelbase) * Math.tan(steeringAngle);
        carPhysics.angle += angularVelocity;
    }

    // 위치 갱신 (전진은 -Z 방향)
    // 수학적으로 Three.js에서 Y축 양의 방향 회전(왼쪽 꺾임) 시 X축 이동은 음수 방향이어야 함
    carPhysics.x -= Math.sin(carPhysics.angle) * carPhysics.speed;
    carPhysics.z -= Math.cos(carPhysics.angle) * carPhysics.speed;

    // 3D 모델에 위치 및 각도 적용
    carGroup.position.set(carPhysics.x, 0, carPhysics.z);
    carGroup.rotation.y = carPhysics.angle;
    
    // 바퀴 회전 애니메이션 (Roll)
    const wheelRadius = 0.4;
    wheelMeshes.forEach(w => w.rotation.x -= carPhysics.speed / wheelRadius);
    
    // 앞바퀴 조향 애니메이션 (Steer)
    frontWheelGroups.forEach(g => g.rotation.y = steeringAngle);

    // 카메라 추적: 운전자 체이스 뷰 (차량 바로 뒤에 바짝 붙어 함께 회전)
    // 매트릭스를 사용하여 차량의 로컬 좌표계 기준으로 카메라 위치와 시선 고정
    carGroup.updateMatrixWorld();
    
    // 목표 카메라 위치: 답답함을 해소하기 위해 뒤로 14m, 위로 5.5m로 거리를 넉넉히 둠
    const localCamOffset = new THREE.Vector3(0, 5.5, 14);
    const targetCamPos = localCamOffset.applyMatrix4(carGroup.matrixWorld);

    if (!camera.initializedLerp) {
        camera.position.copy(targetCamPos);
        camera.initializedLerp = true;
    } else {
        // 카메라가 차량 후방을 부드럽고 묵직하게 쫓아감
        camera.position.lerp(targetCamPos, 0.15);
    }

    // 카메라는 항상 자동차의 앞쪽 전방(10m 앞)을 뚫어져라 응시함 (멀미 완벽 차단)
    const localLookAtOffset = new THREE.Vector3(0, 1.5, -10);
    const targetLookAt = localLookAtOffset.applyMatrix4(carGroup.matrixWorld);
    camera.lookAt(targetLookAt);

    checkCollisions();
    checkWinCondition();
}

function gameLoop() {
    if(!isGameOver) {
        updatePhysics();
        updateEnvironment(); // 생동감 3D 지형지물 애니메이션 프레임
        drawMinimap(); // 매 프레임 실시간 미니맵 렌더링
        renderer.render(scene, camera);
        animationId = requestAnimationFrame(gameLoop);
    }
}

// --- 게임 제어 ---
function startTimer() {
    document.getElementById('timer').innerText = timerValue;
    document.getElementById('timer-box').style.borderColor = "#0f0";
    document.getElementById('timer-box').style.color = "#0f0";

    timerInterval = setInterval(() => {
        timerValue--;
        document.getElementById('timer').innerText = timerValue;
        
        if(timerValue <= 10) {
            document.getElementById('timer-box').style.borderColor = "#f00";
            document.getElementById('timer-box').style.color = "#f00";
        }

        if(timerValue <= 0) {
            gameOver(false, "TIME OVER!");
        }
    }, 1000);
}

function startGame(difficulty) {
    if (difficulty === 'MEDIUM' && localStorage.getItem('unlocked_MEDIUM') !== 'true') return;
    if (difficulty === 'DIFFICULT' && localStorage.getItem('unlocked_DIFFICULT') !== 'true') return;

    currentDifficulty = difficulty;
    isGameOver = false;
    
    document.getElementById('main-menu').classList.add('hidden');
    const gameScreen = document.getElementById('game-screen');
    gameScreen.classList.remove('hidden');
    document.getElementById('game-overlay').classList.add('hidden');
    
    // DOM이 화면에 그려진 후 컨테이너 크기를 정확히 가져오기 위해 지연
    setTimeout(() => {
        if (typeof THREE === 'undefined') {
            alert("3D 엔진(Three.js)을 불러오지 못했습니다. 인터넷 연결을 확인해주세요.");
            return;
        }
        
        initThreeJS();
        buildMap(difficulty);
        createCar();
        bindControls();
        
        startTimer();
        gameLoop();
    }, 100);
}

function gameOver(win, msgText) {
    isGameOver = true;
    clearInterval(timerInterval);
    
    if (win) {
        if (currentDifficulty === 'EASY') {
            localStorage.setItem('unlocked_MEDIUM', 'true');
        } else if (currentDifficulty === 'MEDIUM') {
            localStorage.setItem('unlocked_DIFFICULT', 'true');
        }
    }

    const overlay = document.getElementById('game-overlay');
    const msg = document.getElementById('result-message');
    
    overlay.classList.remove('hidden');
    msg.textContent = msgText;
    msg.style.color = win ? "#0f0" : "#f00";
}

function backToMenu() {
    cancelAnimationFrame(animationId);
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('canvas-container').innerHTML = ''; // 캔버스 정리
}

// --- 컨트롤러 바인딩 ---
function bindControls() {
    const bindBtn = (id, key) => {
        const btn = document.getElementById(id);
        const press = (e) => { e.preventDefault(); controls[key] = true; btn.classList.add('active'); };
        const release = (e) => { e.preventDefault(); controls[key] = false; btn.classList.remove('active'); };
        
        btn.addEventListener('touchstart', press, {passive: false});
        btn.addEventListener('touchend', release, {passive: false});
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
    };

    bindBtn('btn-gas', 'gas');
    bindBtn('btn-brake', 'brake');

    // 가상 핸들 로직 (답답한 원형 터치 회전을 버리고, 직관적인 좌우 스와이프 드래그 방식으로 변경)
    const wheel = document.getElementById('steering-wheel');
    const wheelContainer = document.querySelector('.steering-wheel-container');
    let startX = 0;
    let startWheelAngle = 0;
    let currentWheelAngle = 0;

    const startSteer = (e) => {
        e.preventDefault();
        isSteeringActive = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startWheelAngle = currentWheelAngle;
        wheel.style.transition = 'none';
    };

    const moveSteer = (e) => {
        if (!isSteeringActive) return;
        e.preventDefault();
        const currentX = e.touches ? e.touches[0].clientX : e.clientX;
        const deltaX = currentX - startX;
        
        // 민감도 상향: 손가락 피로도를 낮추기 위해 1px 당 0.8도로 올려 부드럽고 쉽게 끝까지 꺾이도록 튜닝
        let angle = startWheelAngle + deltaX * 0.8;
        
        // 핸들 최대 회전각 (120도로 조정)
        if (angle > 120) angle = 120;
        if (angle < -120) angle = -120;
        
        currentWheelAngle = angle;
        wheel.style.transform = `rotate(${angle}deg)`;
        
        // UI 핸들 각도를 게임 물리 엔진에 적용
        steeringAngle = -(angle / 120) * maxSteering;
    };

    const endSteer = (e) => {
        isSteeringActive = false;
        // 핸들 시각적 복원 (스프링 효과)
        wheel.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        wheel.style.transform = 'rotate(0deg)';
        currentWheelAngle = 0;
    };

    // wheel 자체가 아닌 컨테이너에 이벤트를 걸어 터치 빗나감 방지
    wheelContainer.addEventListener('mousedown', startSteer);
    window.addEventListener('mousemove', moveSteer);
    window.addEventListener('mouseup', endSteer);

    wheelContainer.addEventListener('touchstart', startSteer, {passive: false});
    window.addEventListener('touchmove', moveSteer, {passive: false});
    window.addEventListener('touchend', endSteer);
}

// 키보드 지원
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if(key === 'arrowup' || key === 'w') { 
        controls.gas = true; 
        const btn = document.getElementById('btn-gas');
        if(btn) btn.classList.add('active');
    }
    if(key === 'arrowdown' || key === 's') { 
        controls.brake = true; 
        const btn = document.getElementById('btn-brake');
        if(btn) btn.classList.add('active');
    }
    if(key === 'arrowleft' || key === 'a') { 
        controls.left = true; 
    }
    if(key === 'arrowright' || key === 'd') { 
        controls.right = true; 
    }
    
    // 방향키로 화면이 스크롤되는 것을 방지
    if(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if(key === 'arrowup' || key === 'w') { 
        controls.gas = false; 
        const btn = document.getElementById('btn-gas');
        if(btn) btn.classList.remove('active');
    }
    if(key === 'arrowdown' || key === 's') { 
        controls.brake = false; 
        const btn = document.getElementById('btn-brake');
        if(btn) btn.classList.remove('active');
    }
    if(key === 'arrowleft' || key === 'a') { 
        controls.left = false; 
    }
    if(key === 'arrowright' || key === 'd') { 
        controls.right = false; 
    }
});

// --- 미니맵 렌더링 ---
function drawMinimap() {
    const canvas = document.getElementById('minimap');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 캔버스 초기화
    ctx.clearRect(0, 0, width, height);
    
    // 월드 좌표(-50 ~ 50)를 미니맵 캔버스 좌표(0 ~ 120)로 변환하는 헬퍼 함수
    // 맵 전체 크기가 100x100 이므로 +50을 하여 0~100 범위로 만들고 캔버스 폭에 맞게 스케일링
    const mapToMinimap = (val, maxCanvas) => {
        return (val + 50) * (maxCanvas / 100);
    };

    // 1. 벽(장애물) 그리기 (회색)
    ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
    walls.forEach(wall => {
        const mx = mapToMinimap(wall.x, width);
        const mz = mapToMinimap(wall.z, height);
        const mw = wall.w * (width / 100);
        const ml = wall.l * (height / 100);
        ctx.fillRect(mx, mz, mw, ml);
    });

    // 2. 목적지(주차구역) 그리기 (초록색)
    if (parkingSpot) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        const px = mapToMinimap(parkingSpot.x - parkingSpot.w/2, width);
        const pz = mapToMinimap(parkingSpot.z - parkingSpot.l/2, height);
        const pw = parkingSpot.w * (width / 100);
        const pl = parkingSpot.l * (height / 100);
        ctx.fillRect(px, pz, pw, pl);
    }

    // 3. 내 자동차 그리기 (빨간색 화살표)
    const cx = mapToMinimap(carPhysics.x, width);
    const cz = mapToMinimap(carPhysics.z, height);
    
    ctx.save();
    ctx.translate(cx, cz);
    
    // Three.js의 Y축 회전은 반시계방향(+), 캔버스는 시계방향(+)이므로 부호 반대
    ctx.rotate(-carPhysics.angle); 
    
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    // 화살표 윗부분 (자동차 전면)
    ctx.moveTo(0, -6); 
    // 화살표 양옆 (자동차 후면)
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.fill();
    ctx.restore();
}

let W  = 0, H = 0;
let startTime = new Date();
/// 다각형의 최소 너비, 최소 높이, 클릭 판정 최소 거리(앱실론), float 용 앱실론
const MIN_WIDTH = 25, MIN_HEIGHT = 25, EPS = 10, SMALL_EPS = 1;
const INF = 100000000000;
const cursor = document.querySelector('.cursor');

///// 전처리 코드 시작
function canvasResize(){

    let cvs = document.getElementById("canvas_result");
    let img_result = document.getElementById('img_result');
    let ctx = cvs.getContext("2d");

    W = cvs.width = img_result.width;
    H = cvs.height = img_result.height;
    ctx.drawImage(img_result, 0, 0, img_result.width, img_result.height);

    drawAll();
}

function canvasInit()
{
    /// Canvas 에 click, mousemove, contextmenu(우클릭) 이벤트를 달아준다
    let cvs = document.getElementById("canvas_result");
    let ctx = cvs.getContext("2d");
    cvs.addEventListener("click",function(e){ clicking(e); });
    cvs.addEventListener("mousemove",function(e){ move(e); });
    cvs.addEventListener("contextmenu", function (e){ e.preventDefault(); deleting(e)});
}

window.onload = function(e){
    /// Canvas Resize 와 Init 이 window.onload 에서 굳이 실행되는 이유는
    /// 이미지 로드하기 전에 W, H를 부르면 W = 0, H = 0 값이 들어가기에,
    /// "이미지 로드된 후"에 W, H 값을 설정하고 나서, 이에 맞게 Canvas 를 그리기 위함
    /// W, H를 따로 설정하면 Canvas 좌표 구하기가 비교적 쉬워진다
    canvasResize();
    canvasInit();

    /// 이건 그냥 OCR Site 에도 있던, 화면이 중간에 바뀔 때, UI 깨지는거 방지하려고 있는 코드
    let menu_box = document.getElementById("menu_box");
    let image_frame = document.getElementById("image_frame");
    menu_box.style.minHeight = window.innerHeight;
    image_frame.style.minHeight = window.innerHeight;

};

///// 여기까지 전처리 코드 끝
///////////////////////////////////////////////////////////////////////////////////////////
///// 여기서부터 Canvas 내의 이벤트 들에 대한 자세한(?) 함수들

/// 직사각형의 개수(N) 및 그 좌표를 저장
let N = 0;
let Polygon = [];
let PolygonCount = [];

/// POST 할 때 filename 도 보내야 하므로, filename 도 저장
let filename = "";

/// 현재 클릭이벤트의 상태를 저장하는 함수
let isClick = false; /// 단순한 클릭, 새로운 직사각형을 그리고 있는가 ?
let isModify = false; /// 꼭짓점이나 변 수정, 지금 다각형을 수정하고 있는가 ?
let isPolygonMove = 0; /// 다각형 내부 선택 및 이동, 지금 직사각형을 이동하고 있는가 ?
/// isPolygonMove 는 true false 가 아니라 0,1,2로 발동된 횟수를 의미
/// 0 : 선택되지 않음 / 1. 직사각형이 선택됨 / 2 : 직사각형이 또 선택되서 이동되는 중
/// 1.에서 2.로 넘어가거나, 혹은 해당 직사각형의 외부를 클릭 시, 0으로 다시 바뀜 ( 선택 상태 해제 )

/// 클릭 이벤트가 한 번 발동 시, 멈출 때까지 저장
let CurrentN = 0; /// 정점 개수 및
let CurrentPolygon = []; /// 정점 위치, 각 CurrentPolygon[i]안에는 다음과 같은 구조체가 들어간다. {x: [], y: []};

/// Modify 이벤트 발동 시, 어느 정점인지(ModifyIdx)
let ModifyIdx = -1;

/// Polygon Move 이벤트 발동시
let MoveIdx = -1;
/// Polygon[MoveIdx][0]번과의 거리 차이
let MoveDotDiff = {
    x:0, y:0
};

/// Nearing ( 가까운 점을 찾는 함수 ) 발생시, 변수인지 꼭짓점인지
/// Object Detection 용 Labeling 툴에는 필요했지만 현재는 필요하지 않을 것 같아서 일단 주석
// const VERTEX = 1;
// const NODE = 2;
// let SelectNearKind = 0;
// /// Select 는 Modify 이벤트 시 필요한 것이고, MoveNearDot 는 무브 이벤트 시, 마우스 커서 모양 변경을 위해 필요한 것
// let SelectNearDot = [false, false, false, false]; // xmin, ymin, xmax, ymax
// let MoveNearDot = [false, false, false, false];

function valueInit(inputFilename, inputW, inputH, inputArray){
    /// 벡엔드에서 보내준 DB 에서, 값이 있다면 해당 값으로 초기화한다
    filename = inputFilename;
    N = inputArray.length;
    W = inputW;
    H = inputH;
    for(let i = 0; i < N ; i++ ) {
        PolygonCount[i] = inputArray[i].length;
        Polygon[i] = [];
        for (let j = 0; j < PolygonCount[i]; j++)
            Polygon[i][j] = {
                x: inputArray[i][j][0], y: inputArray[i][j][1]
            };
    }
}

function clicking(e) {
    /// 클릭 이벤트 시 시행되는 함수
    let cvs = document.getElementById("canvas_result");
    let ctx = cvs.getContext("2d");
    let img_result = document.getElementById('img_result');

    /// Canvas 내의 좌표 위치 재계산
    startX = (e.offsetX * W / cvs.offsetWidth);
    startY = (e.offsetY * H / cvs.offsetHeight);
    /// 선택된 것이 만약 있을 경우, 영역밖일 경우, 혹은 다른 이벤트 시행될 경우 ( 여기까지 고려할 일은 없겠지만 캔버스 위에서 온갖 이상한 클릭을 하는 사용자를 사전에 방지하기 위해서 )
    /// 선택 상태 해제

    /// 이 변수는, 선택된 것을 다시 클릭하거나, 무언가를 처음 선택하는 이벤트가 발생 시 false 가 되며,
    /// 그러한 이벤트가 발생하지 않을 경우, "함수의 맨 마지막에서 선택상태를 해제하므로
    /// 혹시나 함수 중간에 다른 이벤트를 추가하거나 수정할 때, 중간에서 return 을 하지 않는 것을 권장
    let isSelectRemove = true;

    let NearIdx = nearing(startX, startY);
    let isInPolygon = isPointInPolygon(startX, startY);
    let NearLine = inputDotOutputNearLine(startX, startY); /// 결과 값은 i,j 로 온다. i번째 Polygon의 j번째 성분.

    if(isModify){
        /// Polygon Move 중의 값을 그릴 때, 값을 잠시 변화하기 위해, 원본 저장
        let OriginalDot = {
            x:Polygon[ModifyIdx.i][ModifyIdx.j].x,
            y:Polygon[ModifyIdx.i][ModifyIdx.j].y
        };
        Polygon[ModifyIdx.i][ModifyIdx.j] = {
            x:startX,
            y:startY
        };

        let isNotIntersect = true;
        /// 선택된 정점과 이어진 두 개의 간선을 구한다 (ModifyPrev, ModifyNext)
        let ModifyPrev, ModifyNext;
        if(ModifyIdx.j-1 === -1) ModifyPrev = { first: PolygonCount[ModifyIdx.i] -1, second: ModifyIdx.j };
        else ModifyPrev = { first: ModifyIdx.j-1, second: ModifyIdx.j };

        if(ModifyIdx.j+1 === PolygonCount[ModifyIdx.i]) ModifyNext = { first: ModifyIdx.j, second: 0 };
        else ModifyNext = { first: ModifyIdx.j, second: ModifyIdx.j+1 };

        if(isIntersectLineInPolygon(ModifyIdx.i, ModifyPrev) || isIntersectLineInPolygon(ModifyIdx.i, ModifyNext))
            isNotIntersect = false;

        if(isNotIntersect === false){
            Polygon[ModifyIdx.i][ModifyIdx.j] = {
                x:OriginalDot.x,
                y:OriginalDot.y
            };
        }

        isModify = false;
    }
    else if(isClick){
        /// 시작점과의 거리
        let startDistance = Math.sqrt(getDistance2(startX,startY,CurrentPolygon[0].x,CurrentPolygon[0].y));

        if( startDistance < EPS) {
            CurrentPolygon[CurrentN] = {
                x:startX, y:startY
            };
            let isNotIntersect = true;
            // if(isIntersectLineAndAllPolygon(CurrentPolygon[CurrentN-1], CurrentPolygon[CurrentN]))
            //     isNotIntersect = false;
            if( CurrentN >= 3 && isIntersectLineAndCurrentPolygon(CurrentPolygon[CurrentN-1], CurrentPolygon[CurrentN], true)) {
                isNotIntersect = false;
            }
            if(isNotIntersect && CurrentN >= 3){
                Polygon[N] = [];
                PolygonCount[N] = CurrentN;
                for(let i = 0; i < CurrentN; i++ ){
                    Polygon[N][i] = {
                        x:CurrentPolygon[i].x,y:CurrentPolygon[i].y
                    }
                }
                N = N + 1;
                isClick = false;
                CurrentN = 0;
            }
        }
        else{

            CurrentPolygon[CurrentN] = {
                x:startX, y:startY
            };

            let isNotIntersect = true;
            // if(isIntersectLineAndAllPolygon(CurrentPolygon[CurrentN-1], CurrentPolygon[CurrentN]))
            //     isNotIntersect = false;
            if( CurrentN >= 3 && isIntersectLineAndCurrentPolygon(CurrentPolygon[CurrentN-1], CurrentPolygon[CurrentN], false)) {
                isNotIntersect = false;
            }
            if(isNotIntersect){
                CurrentN = CurrentN + 1;
            }
        }
    }
    else if(isPolygonMove === 2){
        /// Polygon 움직일 때, 조금이라도 Canvas 삐져나가면 원상복구 해버린다.
        let temp = [];
        let isPossible = true;
        for( let i = 0; i < PolygonCount[MoveIdx]; i++ ){
            temp[i] = {
                x: startX + MoveDotDiff[i].x,
                y: startY + MoveDotDiff[i].y
            };
            if( temp[i].x < 0 || W < temp[i].x ) isPossible = false;
            if( temp[i].y < 0 || H < temp[i].y ) isPossible = false;
        }

        if(isPossible){
            for( let i = 0; i < PolygonCount[MoveIdx]; i++ ){
                Polygon[MoveIdx][i] = {
                    x: temp[i].x,
                    y: temp[i].y
                };
            }
        }
        isPolygonMove = 0;
    }
    else{
        /// 먼저 클릭한 점과 가장 가까운 점(그리고, 10 px 안에 있는 것)이 있는지를 찾고,
        if(NearIdx.i !== -1){
            ModifyIdx = { i:NearIdx.i, j:NearIdx.j};
            isModify = true;
        }
        /// 클릭한 점과 가까운 10px 안에 있는 라인이 있는지를 찾고,
        else if(NearLine.i !== -1){
            let addX = startX;
            let addY = startY;
            addDotAtPolygon(NearLine.i, NearLine.j+1, addX, addY);
        }
        /// 혹은 클릭한 점이 어느 다각형 안에라도 포함되어 있는지를 찾고,
        else if(isInPolygon !== -1){
            /// 처음 선택되는 거라면, 선택 상태로 지정 (1번 상태)
            if(isPolygonMove === 0 ){
                MoveIdx = isInPolygon;
                isPolygonMove = 1;
            }
            /// 선택된 것이 이미 있는데, 또 무언가 클릭된 거라면
            else if(isPolygonMove === 1){
                /// 이번에도 선택된 것이 같은 점이라면
                /// 선택 상태를 잡을 때는, 가장 먼저 그려진 다각형 안에 잡으므로,
                /// 따로, 선택된 다각형 안에 있는지 판별한다

                let X = { x:startX, y:startY };
                let Infinite = { x:-1, y:INF }; /// 절대 다각형 안에 없는 값
                let cnt = isIntersectLineAndPolygon(X,Infinite, MoveIdx);

                if( cnt % 2 === 1){
                    isInPolygon = MoveIdx;
                }

                /// 선택된 다각형 안에 있는 것이 맞다면
                if(isInPolygon === MoveIdx){
                    /// 다각형 선택 & 이동 상태로 변경 (2번 상태)
                    MoveDotDiff = [];

                    for( let i = 0; i < PolygonCount[MoveIdx]; i++ ){
                        MoveDotDiff[i] = {
                            x: Polygon[MoveIdx][i].x - startX,
                            y: Polygon[MoveIdx][i].y - startY
                        }
                    }

                    isPolygonMove = 2;
                }
                // 다른 선택된 것이 있다면, 선택된 것을 "교체" 하고, 1 상태 유지
                else{
                    MoveIdx = isInPolygon;
                    isPolygonMove = 1;
                }
            }
            isSelectRemove = false;
        }
        /// 없다면, 새로 다각형 그리는 이벤트를 시작
        else{
            CurrentN = 0;
            CurrentPolygon[CurrentN] = {
                x:startX, y:startY
            };
            CurrentN = CurrentN + 1;
            isClick = true;
        }
    }

    /// 그 어느 다각형 내부도 선택 되지 않고, 다른 것이 선택될 경우, 무조건 선택 상태 해제
    if(isSelectRemove === true){
        isPolygonMove = 0;
    }
    drawAll();
    if(isClick){
        currentDrawAll();
    }
}

function move(e) {
    let cvs = document.getElementById("canvas_result");
    let ctx = cvs.getContext("2d");
    /// Canvas 에 나타나는 좌표 위치 재계산
    let startX = (e.offsetX * W / cvs.offsetWidth);
    let startY = (e.offsetY * H / cvs.offsetHeight);

    let NearIdx = nearing(startX, startY);
    let isInPolygon = isPointInPolygon(startX, startY);
    let NearLine = inputDotOutputNearLine(startX, startY); /// 결과 값은 i,j 로 온다. i번째 Polygon의 j번째 성분.

    if(isModify){
        /// Polygon Move 중의 값을 그릴 때, 값을 잠시 변화하기 위해, 원본 저장
        let OriginalDot = {
            x:Polygon[ModifyIdx.i][ModifyIdx.j].x,
            y:Polygon[ModifyIdx.i][ModifyIdx.j].y
        };
        Polygon[ModifyIdx.i][ModifyIdx.j] = {
            x:startX,
            y:startY
        };

        let isNotIntersect = true;
        /// 선택된 정점과 이어진 두 개의 간선을 구한다 (ModifyPrev, ModifyNext)
        let ModifyPrev, ModifyNext;
        if(ModifyIdx.j-1 === -1) ModifyPrev = { first: PolygonCount[ModifyIdx.i] -1, second: ModifyIdx.j };
        else ModifyPrev = { first: ModifyIdx.j-1, second: ModifyIdx.j };
        if(ModifyIdx.j+1 === PolygonCount[ModifyIdx.i]) ModifyNext = { first: ModifyIdx.j, second: 0 };
        else ModifyNext = { first: ModifyIdx.j, second: ModifyIdx.j+1 };
        if(isIntersectLineInPolygon(ModifyIdx.i, ModifyPrev) || isIntersectLineInPolygon(ModifyIdx.i, ModifyNext))
            isNotIntersect = false;
        drawAll();

        if(isNotIntersect === false){
            /// 이렇게 이동할 경우, 선분 교차가 되기에, 해당 선분 및 정점을 빨간색으로 띄움으로써 에러 표시
            ctx.strokeStyle = "#FF0000";
            ctx.fillStyle = "#FF0000";
            ctx.beginPath();
            ctx.moveTo(Polygon[ModifyIdx.i][ModifyPrev.first].x, Polygon[ModifyIdx.i][ModifyPrev.first].y);
            ctx.lineTo(Polygon[ModifyIdx.i][ModifyPrev.second].x, Polygon[ModifyIdx.i][ModifyPrev.second].y);
            ctx.moveTo(Polygon[ModifyIdx.i][ModifyNext.first].x, Polygon[ModifyIdx.i][ModifyNext.first].y);
            ctx.lineTo(Polygon[ModifyIdx.i][ModifyNext.second].x, Polygon[ModifyIdx.i][ModifyNext.second].y);
            ctx.closePath();
            ctx.globalAlpha = 1.0;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(startX, startY, 10, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();

        }

        Polygon[ModifyIdx.i][ModifyIdx.j] = {
            x:OriginalDot.x,
            y:OriginalDot.y
        };

    }
    else if(isPolygonMove === 2){
        /// Polygon Move 중의 값을 그릴 때, 값을 잠시 변화하기 위해, 원본 저장
        let OriginalPoly = [];
        for( let i = 0; i < PolygonCount[MoveIdx]; i++ ){
            OriginalPoly[i] = {
                x: Polygon[MoveIdx][i].x,
                y: Polygon[MoveIdx][i].y
            };
        }

        for( let i = 0; i < PolygonCount[MoveIdx]; i++ ){
            Polygon[MoveIdx][i] = {
                x: startX + MoveDotDiff[i].x,
                y: startY + MoveDotDiff[i].y
            };
        }
        drawAll();
        for( let i = 0; i < PolygonCount[MoveIdx]; i++ ){
            Polygon[MoveIdx][i] = {
                x: OriginalPoly[i].x,
                y: OriginalPoly[i].y
            };
        }

    }
    else if(isClick){
        let startDistance = Math.sqrt(getDistance2(startX,startY,CurrentPolygon[0].x,CurrentPolygon[0].y));

        drawAll();
        currentDrawAll();
        CurrentPolygon[CurrentN] = {
            x:startX, y:startY
        };

        let isNotIntersect = true;
        // if(isIntersectLineAndAllPolygon(CurrentPolygon[CurrentN-1], CurrentPolygon[CurrentN]))
        //     isNotIntersect = false;
        if( CurrentN >= 3 && isIntersectLineAndCurrentPolygon(CurrentPolygon[CurrentN-1], CurrentPolygon[CurrentN], false)) {
            isNotIntersect = false;
        }

        /// 만약 시작정점과 이어서 다각형을 만들 수 있다면, 시작 정점을 파란색으로
        if(startDistance < EPS){
            ctx.fillStyle = "darkgreen";
            ctx.strokeStyle = "darkgreen";
            ctx.beginPath();
            ctx.arc(CurrentPolygon[0].x, CurrentPolygon[0].y, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        /// 현재 간선의 상태를 칠한다. 가능한 간선이면 초록색, 교차가 일어나 불가능하면 빨간색
        if(isNotIntersect || startDistance < EPS){
            ctx.fillStyle = "#00ff00";
            ctx.strokeStyle = "#00ff00";
        }
        else {
            ctx.fillStyle = "#ff0000";
            ctx.strokeStyle = "#ff0000";
        }

        ctx.beginPath();
        ctx.moveTo(CurrentPolygon[CurrentN-1].x, CurrentPolygon[CurrentN-1].y);
        ctx.lineTo(startX, startY);
        ctx.stroke();
    }
    else if(NearIdx.i !== -1) {
        drawAll();
        ctx.fillStyle = "darkgreen";
        ctx.strokeStyle = "darkgreen";
        ctx.beginPath();
        ctx.arc(Polygon[NearIdx.i][NearIdx.j].x, Polygon[NearIdx.i][NearIdx.j].y, 10, 0, Math.PI * 2);
        ctx.fill();
    }
    else if(NearLine.i !== -1){
        drawAll();
        ctx.fillStyle = "darkgreen";
        ctx.strokeStyle = "darkgreen";
        ctx.beginPath();
        ctx.moveTo(Polygon[NearLine.i][NearLine.j].x, Polygon[NearLine.i][NearLine.j].y);
        let nextLine;

        if(NearLine.j+1 === PolygonCount[NearLine.i]){
            nextLine = { x:Polygon[NearLine.i][0].x, y:Polygon[NearLine.i][0].y }
        }
        else{
            nextLine = { x:Polygon[NearLine.i][NearLine.j+1].x, y:Polygon[NearLine.i][NearLine.j+1].y }
        }
        ctx.lineTo(nextLine.x, nextLine.y);
        ctx.stroke();
        ctx.fillStyle = "#ffff00";
        ctx.strokeStyle = "#00ff00";
        ctx.beginPath();
        ctx.arc(startX, startY, 10, 0, Math.PI * 2);
        ctx.fill();

    }
    else{
        drawAll();
    }
}

function deleting(e) {
    /// 우클릭 이벤트 발동시 실행되는 함수
    let cvs = document.getElementById("canvas_result");
    let ctx = cvs.getContext("2d");
    let startX = (e.offsetX * W / cvs.offsetWidth);
    let startY = (e.offsetY * H / cvs.offsetHeight);
    let NearIdx = nearing(startX, startY);
    let isInPolygon = isPointInPolygon(startX, startY);

    if(isPolygonMove === 1){
        if(isInPolygon !== -1){
            deletePolygon(isInPolygon);
        }
        isPolygonMove = 0;
    }
    else if(isClick){
        isClick = false;
    }
    /// TODO : Dot Delete / 이 점을 지우면 교차하는지 판정하는거 해야함
    else if(NearIdx.i !== -1){
        if(PolygonCount[NearIdx.i]>=4){

            // let OriginalPoly = [];
            // for( let i = 0; i < PolygonCount[NearIdx.i]; i++ ){
            //     OriginalPoly[i] = {
            //         x: Polygon[NearIdx.i][i].x,
            //         y: Polygon[NearIdx.i][i].y
            //     };
            // }

            deleteDotAtPolygon(NearIdx.i, NearIdx.j);


            // if(/* TODO: 대충 이 라인이 현재 폴리곤과 교차하는지 안하는지 판정하는 함수  */ ){
            //     PolygonCount[NearIdx.i] = PolygonCount[NearIdx.i] + 1;
            //     for( let i = 0; i < PolygonCount[NearIdx.i]; i++ ){
            //         Polygon[NearIdx.i][i] = {
            //             x: OriginalPoly[i].x,
            //             y: OriginalPoly[i].y
            //         };
            //     }
            // }


        }
    }
    drawAll();
}

function nearing(x, y) {
    /// 좌표가 주어지면, EPS px 안쪽이 있는 것 중 가장 가까운 점을 찾는다
    let mini = 1000000000, mini_idx=-1;
    let ret = {i:-1,j:-1};
    /// 가장 가까운 점은, (x1-x2)^2 + (y1-y2)^2 (==거리의 제곱) 이 가장 작은 것을 찾는다.
    for( let i = 0; i < N ; i++ ) {
        for(let j = 0; j < PolygonCount[i] ; j++ ){
            /// x 좌표가 작은 것으로 갱신, 갱신할 때, y 좌표가 직사각형 범위 안에 있는지 확인
            let dist2 = getDistance2(x,y,Polygon[i][j].x,Polygon[i][j].y);
            if(dist2 < mini){
                mini = dist2;
                ret = { i:i, j:j};
            }
        }
    }

    let dist = Math.sqrt(mini);
    if( dist > EPS ) ret = {i:-1,j:-1};

    return ret;
}

function currentDrawAll(){
    /// 그리고 있는 중인 다각형을 그린다.
    let cvs = document.getElementById("canvas_result");
    let ctx = cvs.getContext("2d");
    ctx.strokeStyle = "#00ff00";
    ctx.fillStyle = "#00ff00";
    for(let i = 0; i < CurrentN; i++ ){
        if(i===0){
            ctx.beginPath();
            ctx.moveTo(CurrentPolygon[i].x, CurrentPolygon[i].y);
        }
        else{
            ctx.lineTo(CurrentPolygon[i].x, CurrentPolygon[i].y);
        }
    }
    ctx.stroke();

    for(let i = 0; i < CurrentN; i++ ){
        ctx.beginPath();
        ctx.arc(CurrentPolygon[i].x, CurrentPolygon[i].y, 10, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawAll() {
    /// "그리고 있는 중인 다각형" 말고, 전체를 다시 그리는 함수
    let cvs = document.getElementById("canvas_result");
    let ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    let img_result = document.getElementById('img_result');
    ctx.drawImage(img_result, 0, 0, img_result.width, img_result.height);

    /// 다각형 그리기
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#00ff00";
    for(let i = 0; i < N ; i++ ) {
        for(let j = 0; j < PolygonCount[i]; j++ ){
            if(j===0){
                ctx.beginPath();
                ctx.moveTo(Polygon[i][j].x, Polygon[i][j].y);
            }
            else{
                ctx.lineTo(Polygon[i][j].x, Polygon[i][j].y);
            }
        }
        ctx.closePath();
        ctx.fillStyle = "#00ff00";
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();
    }

    /// 다각형 정점 그리기
    for(let i = 0; i < N ; i++ ) {
        for (let j = 0; j < PolygonCount[i]; j++) {
            ctx.beginPath();
            ctx.arc(Polygon[i][j].x, Polygon[i][j].y, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /// 선택된 다각형이 있다면, 해당 다각형 그리기
    /// 선택된 다각형은 파란색으로 표시 된다
    if(isPolygonMove !== 0){

        ctx.fillStyle = "#0000ff";
        ctx.strokeStyle = "#00ff00";
        for(let j = 0; j < PolygonCount[MoveIdx]; j++ ){
            if(j===0){
                ctx.beginPath();
                ctx.moveTo(Polygon[MoveIdx][j].x, Polygon[MoveIdx][j].y);
            }
            else{
                ctx.lineTo(Polygon[MoveIdx][j].x, Polygon[MoveIdx][j].y);
            }
        }
        ctx.closePath();
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();
        ctx.fillStyle = "#00ff00";
        /// 선택된 다각형 정점 그리기
        for(let j = 0; j < PolygonCount[MoveIdx]; j++ ){
            ctx.beginPath();
            ctx.arc(Polygon[MoveIdx][j].x, Polygon[MoveIdx][j].y, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }

}


function deletePolygon(IDX){
    /// 하나씩 왼쪽 옆으로 밀면서 지운다
    for( let i = IDX + 1; i < N ; i++ ){
        for( let j = 0; j < PolygonCount[i]; j++ ){
            Polygon[i-1][j].x = Polygon[i][j].x;
            Polygon[i-1][j].y = Polygon[i][j].y;
        }
        PolygonCount[i-1] = PolygonCount[i];
    }
    delete Polygon[N];
    N = N - 1;
}

function deleteDotAtPolygon(PolygonIDX,DeleteIDX){
    /// 하나씩 왼쪽 옆으로 밀면서 지운다
    for(let j = DeleteIDX; j < PolygonCount[PolygonIDX] - 1; j++ ){
        Polygon[PolygonIDX][j].x = Polygon[PolygonIDX][j+1].x;
        Polygon[PolygonIDX][j].y = Polygon[PolygonIDX][j+1].y;
    }

    PolygonCount[PolygonIDX] = PolygonCount[PolygonIDX] - 1;
}

function addDotAtPolygon(PolygonIDX,AddIDX,x,y){
    /// 하나씩 오른쪽 옆으로 밀고
    Polygon[PolygonIDX][PolygonCount[PolygonIDX]] = {x:0,y:0};
    for(let j = PolygonCount[PolygonIDX]; j >=  AddIDX + 1; j-- ){
        Polygon[PolygonIDX][j].x = Polygon[PolygonIDX][j-1].x;
        Polygon[PolygonIDX][j].y = Polygon[PolygonIDX][j-1].y;
    }
    /// 추가한다
    Polygon[PolygonIDX][AddIDX].x = x;
    Polygon[PolygonIDX][AddIDX].y = y;

    PolygonCount[PolygonIDX] = PolygonCount[PolygonIDX] + 1;
}

/////////////////////////////////////////////////////////////////////////////////////
/// 아래는 기하 처리 관련 함수들.

/// 다각형에서 선분 관련 작업을 할 때 N 번째과 1 번째는 따로 연결해주어야 한다 !! 를 잊지 말자.

/// Point(점) 구조채는 {x,y} 로 이루어져 있고,
/// Line(선분)는 Point 두 개로 이루어져 있다. (아래 코드에서 Line 은 구조체로 되지 않고, 그냥 인풋에서 좌표를 두 개 받는다. )

/// Counter Clock Wise
/// 선분 AB를 기준으로 점 C가 Clock Wise 인지 Counter Clock Wise 인지 반환한다

function ccw3(A, B, C){
    // let ret = (A.x-O.x)*(B.y-O.y) - (A.y-O.y)*(B.x-O.x);
    let ret = A.x * B.y + B.x * C.y + C.x * A.y;
    ret -= ( A.y * B.x +  B.y * C.x + C.y * A.x);
    if(ret>0) return 1;
    else if(ret<0) return -1;
    else return 0;
}

/// 거리 반환
function getDistance(x, y, x2, y2) {
    return Math.sqrt(getDistance2(x,y,x2,y2));
}

/// 거리 제곱 반환,
function getDistance2(x, y, x2, y2) {
    return ((x-x2)*(x-x2)) + ((y-y2)*(y-y2));
}

/// 두 선분 a, b의 양 끝의 좌표가 주어지면 교차 여부 true / false 반환
/// Ex ) a는 (af.x, af.y), (bf.x, bf.y)로 이루어져 있다.
/// af, as, bf, bs 는 {x,y}로 이루어진 좌표 구조체다.
function isIntersect(af, as, bf, bs){ /// a.first, a.second, b.first, b.second
    let AF = af;
    let AS = as;
    let BF = bf;
    let BS = bs;
    let one = ccw3(af, as, bf) * ccw3(af, as, bs);
    let two = ccw3(bf, bs, af) * ccw3(bf, bs, as);
    if(one===0&&two===0){
        if(AF>AS){
            let tmp = AF; AF = AS; AS = tmp;
        }
        if(BF>BS){
            let tmp = BF; BF = BS; BS = tmp;
        }
        return (BF <= AS && AF <= BS);
    }
    return (one <=0 && two <= 0);
}


/// Line 한 개와 "특정" Polygon 이 주어졌을 때, 해당 Line 과 Polygon 의 교차점 개수 판단
/// 다각형 내부를 선택하면, 해당 다각형을 선택 상태로 바꾸는데,
/// 다각형 내부가 선택되었는지 판단할 때 쓰인다.
/// cnt 가 홀수라면, 다각형 내부가 선택된 것이고, 짝수라면 다각형 외부가 선택된 것이다.

/// 해당 Polygon 위에 있는 점이라면, 교차점 개수가 2개라면, 해당 Polygon 안에 교차가 없는 것임
function isIntersectLineAndPolygon(X,Y,IDX) {
    let cnt = 0;
    for(let j = 0; j < PolygonCount[IDX]-1 ; j++ ){
        let ret = isIntersect(X,Y,Polygon[IDX][j],Polygon[IDX][j+1]);
        if(ret) cnt = cnt + 1;
    }
    let ret = isIntersect(X,Y,Polygon[IDX][PolygonCount[IDX]-1],Polygon[IDX][0]);
    if(ret) cnt = cnt + 1;
    return cnt;
}


/// Line 한 개가 주어졌을 때, 현재까지의 모든 Polygon 과 교차하는지 여부 판단
function isIntersectLineAndAllPolygon(X,Y){
    for(let i = 0; i < N; i++){
        for(let j = 0; j < PolygonCount[i]-1 ; j++ ){
            let ret = isIntersect(X,Y,Polygon[i][j],Polygon[i][j+1]);
            if(ret) return true;
        }
        let ret = isIntersect(X,Y,Polygon[i][PolygonCount[i]-1],Polygon[i][0]);
        if(ret) cnt = cnt + 1;
    }
    return false;
}

/// Line in Polygon
/// IDX 번째 Polygon 의 J번째 선분이, IDX 번째 Polygon 의 j와 인접하지 않은 모든 선분에 대해 교차 여부 조사
function isIntersectLineInPolygon(IDX, J){
    for( let j = 0; j < PolygonCount[IDX] - 1; j++){
        /// J가 끝 선분인 경우, j == 0 제외
        if( (J.first === 0 || J.second === 0) && j === 0) continue;
        /// j가 J와 인접한 경우 제외
        if( (j === J.first) || (j === J.second) || ((j+1) === J.first) || ((j+1) === J.second) )
            continue;
        if(isIntersect(Polygon[IDX][j], Polygon[IDX][j+1], Polygon[IDX][J.first], Polygon[IDX][J.second] )){
            return true;
        }
    }

    /// 끝 선분에 대해 교차를 할 건데, 그 중 J가 포함하는 것이 있을 경우 제외
    if(J.first !== 0 && J.second !== 0 && J.first !== PolygonCount[IDX] - 1 && J.second !== PolygonCount[IDX] - 1){
        if(isIntersect(Polygon[IDX][PolygonCount[IDX] - 1], Polygon[IDX][0], Polygon[IDX][J.first], Polygon[IDX][J.second] )){
            return true;
        }
    }

    return false;
}

/// Line 한 개가 주어졌을 때, 아직 그리고 있는 큐에 있는 Polygon 과 교차하는지 여부 판단
/// 여기서 Line 은 그리고 있는 큐의 Polygon 에서, 다음에 그릴 Line 만을 가리킨다.
/// 다각형을 완성할 때, isFinish 는, 해당 다각형의 시작점의 선분과의 교차판정이 나는 것을 방지하기 위해 쓰인다.
function isIntersectLineAndCurrentPolygon(X,Y, isFinish) {
    /// 2를 빼는 이유는, 현재 시작점과 붙어있는 바로 이전 것은 어차피 교차하기 때문
    for(let i = 0; i < (CurrentN - 2) ; i++ ){
        if(isFinish && i===0) continue;
        let ret = isIntersect(X,Y,CurrentPolygon[i], CurrentPolygon[i+1]);
        if(ret) return true;
    }
    return false;
}

/// 점(P)과 선분(AB) 사이의 거리 반환
function getDistanceLineAndDot(A,B,P){
    let len = getDistance(A.x, A.y, B.x, B.y);
    if(len===0) return getDistance(A.x, A.y, P.x, P.y);
    let project = ((P.x-A.x)*(B.x-A.x)+(P.y-A.y)*(B.y-A.y))/len;
    if(project<0) return getDistance(A.x, A.y, P.x, P.y);
    else if(project>len) return getDistance(B.x, B.y, P.x, P.y);
    else return Math.abs((P.y-A.y)*(B.x-A.x)-(P.x-A.x)*(B.y-A.y))/len;
}

/// 점이 주어지면, 가장 가까운 선분이, 어느 폴리곤(i)의 몇 번째 선분(j)인지 반환
function inputDotOutputNearLine(x,y){
    let X = { x:x, y:y};
    let ret = { i:-1,j:-1};
    let mini = INF;
    for(let i = 0; i < N; i++){
        for(let j = 0; j < PolygonCount[i]-1 ; j++ ){
            let dist = getDistanceLineAndDot(Polygon[i][j],Polygon[i][j+1],X);
            if(mini > dist){
                mini = dist;
                ret = { i:i, j:j };
            }
        }
        let dist = getDistanceLineAndDot(Polygon[i][PolygonCount[i]-1],Polygon[i][0],X);
        if(mini > dist){
            mini = dist;
            ret = { i:i, j:PolygonCount[i]-1 };
        }
    }
    if(mini>10) return { i: -1, j: -1};
    return ret;
}

/// 점이 Polygon 들 안에 없다면 -1, 있다면 Polygon 좌표 반환
function isPointInPolygon(x,y){
    let X = { x:x,y:y };
    let Infinite = { x:-1, y:INF }; /// 절대 다각형 안에 없는 값
    for(let i = 0 ; i < N ; i++ ){
        let cnt = isIntersectLineAndPolygon(X,Infinite,i);
        if( cnt % 2 === 1) return i;
    }
    return -1;
}

function returnPolyToJSON() {

    let Timer = new Date() - startTime;
    if(Timer<=1000){
        alert("1초 이상 검토하세요");
        return false;
    }

    /// 전송용 데이터의 포멧이 [i][j].x 에서 [i].x[j] 로 바꾼 이유는 detection 이랑 벡엔드 양식 맞추려고
    /// Onsubmit 이벤트가 발동되면 시행되는 함수, iPoly 값을 보낸다.
    let iPoly = [];
    for(let i = 0; i < N ; i++){
        iPoly[i] = {
            x: [], y: []
        };
        for(let j = 0; j < PolygonCount[i]; j++){
            iPoly[i].x[j] = parseInt(Polygon[i][j].x);
            iPoly[i].y[j] = parseInt(Polygon[i][j].y);
        }
    }

    $.ajax({
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify( { filename, iPoly }),
        dataType: "json",
        success: function(response) {
        },
        error: function(err) {
        }
    });
}


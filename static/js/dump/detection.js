let W  = 0, H = 0;
let startTime = new Date();
/// 직사각형의 최소 너비, 최소 높이, 클릭 판정 최소 거리
const MIN_WIDTH = 15, MIN_HEIGHT = 3, EPS = 10;
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
    /// Canvas에 click, mousemove, contextmenu(우클릭) 이벤트를 달아준다
    let cvs = document.getElementById("canvas_result");
    let ctx = cvs.getContext("2d");
    cvs.addEventListener("click",function(e){ clicking(e); });
    cvs.addEventListener("mousemove",function(e){ move(e); });
    cvs.addEventListener("contextmenu", function (e){ e.preventDefault(); deleting(e)});
}

window.onload = function(e) {
    /// Canvas Resize 와 Init 이 window.onload 에서 굳이 실행되는 이유는
    /// 이미지 로드하기 전에 W, H를 부르면 W = 0, H = 0 값이 들어가기에,
    /// "이미지 로드된 후"에 W, H 값을 설정하고 나서, 이에 맞게 Canvas 를 그리기 위함
    /// W, H를 따로 설정하면 Canvas 좌표 구하기가 비교적 쉬워진다
    canvasResize();
    canvasInit();

    /// 이건 그냥 OCR Site에도 있던, 화면이 중간에 바뀔 때, UI 깨지는거 방지하려고 있는 코드
    let menu_box = document.getElementById("menu_box");
    let image_frame = document.getElementById("image_frame");
    menu_box.style.minHeight = window.innerHeight;
    image_frame.style.minHeight = window.innerHeight;

};

///// 여기까지 전처리 코드 끝
///// 여기서부터 Canvas 내의 이벤트 들에 대한 자세한(?) 함수들

/// 직사각형의 개수(N) 및 그 좌표를 저장
let N = 0;
let Rect = [];
/// POST 할 때 filename 도 보내야 하므로, filename 도 저장
let filename = "";

/// 현재 클릭이벤트의 상태를 저장하는 함수
let isClick = false; /// 단순한 클릭, 새로운 직사각형을 그리고 있는가 ?
let isModify = false; /// 꼭짓점이나 변 수정, 지금 직사각형을 수정하고 있는가 ?
let isRectMove = 0; /// 직사각형 내부 선택 및 이동, 지금 직사각형을 이동하고 있는가 ?
/// isRectMove 는 true false 가 아니라 0,1,2로 발동된 횟수를 의미
/// 0 : 선택되지 않음 / 1. 직사각형이 선택됨 / 2 : 직사각형이 또 선택되서 이동되는 중
/// 1.에서 2.로 넘어가거나, 혹은 해당 직사각형의 외부를 클릭 시, 0으로 다시 바뀜 ( 선택 상태 해제 )

/// 클릭 이벤트가 한 번 발동 시, 시작 좌표 저장
let CurrentDot = {
    x: [], y: []
};

/// Modify 이벤트 발동 시, 어느 사각형인지와(ModifyIdx)
/// xmin, ymin, xmax  ymax 중 어느 값들이 수정되고 있는지 저장
/// 그리고, 어디로 수정되었는지 저장(ModifyDot), ModifyDot 은 줄일려면 줄일 수 있는 변수지만, 명시적으로 이해하기 쉽게 사용하기 위해 추가한 변수
let ModifyIdx = -1;
let ModifyDot = {
    x: [], y: []
};

/// RectMove 이벤트 발동시
/// 마찬가지로 줄일려면 줄일 수 있는 변수지만, 명시적으로 이해하기 쉽게 사용하기 위해 추가한 변수
let RectMoveIdx = -1;
/// 기존 xmin, ymin, xmax, ymax 과의 차이, 모두 헷갈리지 않게 양수로 저장하자.
let RectMoveDotDiff = {
    x: [], y: []
};

/// Nearing ( 가까운 점을 찾는 함수 ) 발생시, 추후 어느 변 or 꼭짓점을 수정할 건지 저장하는 변수
/// Select 는 Modify 이벤트 시 필요한 것이고, MoveNearDot 는 무브 이벤트 시, 마우스 커서 모양 변경을 위해 필요한 것
let SelectNearDot = [false, false, false, false]; // xmin, ymin, xmax, ymax
let MoveNearDot = [false, false, false, false];

function valueInit(b_filename, inputW, inputH, inputArray){
    /// 벡엔드에서 보내준 DB에서, 값이 있다면 해당 값으로 초기화한다
    filename = b_filename;
    N = inputArray.length;
    W = inputW;
    H = inputH;
    for(let i = 0; i < N ; i++ ){
        Rect[i] = {x:[], y:[]};
        Rect[i].x[0] = inputArray[i][0];
        Rect[i].y[0] = inputArray[i][1];
        Rect[i].x[1] = inputArray[i][2];
        Rect[i].y[1] = inputArray[i][3];
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

    /// 선택된 것이 만약 있을 경우, 영역밖일 경우, 혹은 다른 이벤트 시행될 경우( 여기까지 고려할 일은 없겠지만 캔버스 위에서 온갖 이상한 클릭을 하는 사용자를 사전에 방지하기 위해서 )
    /// 선택 상태 해제
    ///
    /// 이 변수는, 선택된 것을 다시 클릭하거나, 무언가를 처음 선택하는 이벤트가 발생 시 false 가 되며,
    /// 그러한 이벤트가 발생하지 않을 경우, "함수의 맨 마지막에서 선택상태를 해제하므로
    /// 혹시나 함수 중간에 다른 이벤트를 추가하거나 수정할 때, 중간에서 return 을 하지 않는 것을 권장
    let isSelectRemove = true;

    /// 이 점이 수정되는 점이라면 ? ( 수정 이벤트는 점이 총 2번 찍히는데, 그 2번째 찍는거 의미
    if(isModify){
        /// x 좌표 값을 변화시키겠다고 했다면, x 좌표 변화 반영
        let Original_Rect = { x: [], y: [] };
        Original_Rect.x[0] = Rect[ModifyIdx].x[0];
        Original_Rect.x[1] = Rect[ModifyIdx].x[1];
        Original_Rect.y[0] = Rect[ModifyIdx].y[0];
        Original_Rect.y[1] = Rect[ModifyIdx].y[1];
        let isSmall = false;

        if(SelectNearDot[0]||SelectNearDot[2]){
            if(!SelectNearDot[0]) ModifyDot.x[0] = Rect[ModifyIdx].x[0];
            else if(!SelectNearDot[2]) ModifyDot.x[0] = Rect[ModifyIdx].x[1];

            ModifyDot.x[1] = startX;

            if(ModifyDot.x[0] > ModifyDot.x[1]){
                tmp = ModifyDot.x[0];
                ModifyDot.x[0] = ModifyDot.x[1];
                ModifyDot.x[1] = tmp;
            }
            if( ModifyDot.x[1] - ModifyDot.x[0] < MIN_WIDTH ) isSmall = true;
            Rect[ModifyIdx].x[0] = ModifyDot.x[0];
            Rect[ModifyIdx].x[1] = ModifyDot.x[1];
        }
        /// y 좌표 값을 변화시키겠다고 했다면, y 좌표 변화 반영
        if(SelectNearDot[1]||SelectNearDot[3]){
            if(!SelectNearDot[1]) ModifyDot.y[0] = Rect[ModifyIdx].y[0];
            else if(!SelectNearDot[3]) ModifyDot.y[0] = Rect[ModifyIdx].y[1];
            ModifyDot.y[1] =startY;
            if(ModifyDot.y[0] > ModifyDot.y[1]){
                tmp = ModifyDot.y[0];
                ModifyDot.y[0] = ModifyDot.y[1];
                ModifyDot.y[1] = tmp;
            }
            if( ModifyDot.y[1] - ModifyDot.y[0] < MIN_HEIGHT ) isSmall = true;
            Rect[ModifyIdx].y[0] = ModifyDot.y[0];
            Rect[ModifyIdx].y[1] = ModifyDot.y[1];
        }
        if(isSmall === true){
            Rect[ModifyIdx].x[0] = Original_Rect.x[0];
            Rect[ModifyIdx].x[1] = Original_Rect.x[1];
            Rect[ModifyIdx].y[0] = Original_Rect.y[0];
            Rect[ModifyIdx].y[1] = Original_Rect.y[1];
        }
        /// 좌표가 변했으니까 다시 그린다
        drawAll();
        isModify = false;
    }
    /// 새로운 직사각형을 그리는 이벤트( 새로운 직사각형을 그릴 때는 점이 총 2번 찍히는데, 그 2번째 이벤트
    else if(isClick){
        CurrentDot.x[1] = startX;
        CurrentDot.y[1] = startY;
        // 좌표 정렬, 2개짜리니까 굳이 구조체 정렬 안하고 if문으로 했다
        // 나중에 규모가 커지면 수정하도록 하자
        if(CurrentDot.x[0] > CurrentDot.x[1]){
            tmp = CurrentDot.x[0];
            CurrentDot.x[0] = CurrentDot.x[1];
            CurrentDot.x[1] = tmp;
        }
        if(CurrentDot.y[0] > CurrentDot.y[1]){
            tmp = CurrentDot.y[0];
            CurrentDot.y[0] = CurrentDot.y[1];
            CurrentDot.y[1] = tmp;
        }
        /// 새로운 직사각형의 너비 및 높이 둘 중 하나가 20px 미만이라면 그려지지 않는다
        if( (CurrentDot.x[1]-CurrentDot.x[0]) >= MIN_WIDTH && (CurrentDot.y[1]-CurrentDot.y[0]) >= MIN_HEIGHT ){
            Rect[N] = {x:[], y:[]};
            Rect[N].x[0] = CurrentDot.x[0];
            Rect[N].y[0] = CurrentDot.y[0];
            Rect[N].x[1] = CurrentDot.x[1];
            Rect[N].y[1] = CurrentDot.y[1];
            N = N + 1;
        }
        drawAll();
        isClick = false;
    }
    else if(isRectMove === 2){
        let temp = {
            x:[], y:[]
        };
        temp.x[0] = Math.max( startX - RectMoveDotDiff.x[0], 0);
        temp.y[0] = Math.max(startY - RectMoveDotDiff.y[0], 0);
        temp.x[1] = Math.min( startX + RectMoveDotDiff.x[1], W-1);
        temp.y[1] = Math.min( startY + RectMoveDotDiff.y[1], H-1);

        if( (temp.x[1]-temp.x[0]) >= MIN_WIDTH && (temp.y[1]-temp.y[0]) >= MIN_HEIGHT ) {
            Rect[RectMoveIdx].x[0] = temp.x[0];
            Rect[RectMoveIdx].y[0] = temp.y[0];
            Rect[RectMoveIdx].x[1] = temp.x[1];
            Rect[RectMoveIdx].y[1] = temp.y[1];
        }

        isRectMove = 0;
    }
    /// Modify 나 직사각형 이벤트 상태에 있지 않는, 순수한(?) 클릭 이벤트라면 ?
    else {

        let NearIdx = nearing(startX, startY, true);
        let OverlapIdx = findOverlapIdx(startX, startY);

        /// 먼저 클릭한 점과 가장 가까운 점(그리고, 10 px 안에 있는 것)이 있는지를 찾고,
        if(NearIdx !== -1){
            ModifyIdx = NearIdx;
            isModify = true;
        }
        /// 혹은 클릭한 점이 어느 직사각형 안에라도 포함되어 있는지를 찾고,
        else if(OverlapIdx !== -1){
            /// 처음 선택되는 거라면, 선택 상태로 지정 (1번 상태)
            if(isRectMove === 0){
                RectMoveIdx = OverlapIdx;
                isRectMove = 1;
                cvs.style.cursor = "hand";
            }
            /// 선택된 것이 이미 있는데, 또 무언가 클릭된 거라면
            else if(isRectMove === 1){
                /// 이번에도 선택된 것이 같은 점이라면
                /// 선택 상태를 잡을 때는, 가장 먼저 그려진 직사각형을 잡으므로,
                /// 따로, 선택된 직사각형 안에 있는지 판별한다
                if( Rect[RectMoveIdx].x[0] <= startX && startX <= Rect[RectMoveIdx].x[1] && Rect[RectMoveIdx].y[0] <= startY && startY <= Rect[RectMoveIdx].y[1] ) {
                    OverlapIdx = RectMoveIdx;
                }
                if( OverlapIdx === RectMoveIdx ){
                    /// 직사각형 선택 & 이동 상태로 변경 (2번 상태)
                    RectMoveDotDiff.x[0] = startX - Rect[OverlapIdx].x[0];
                    RectMoveDotDiff.y[0] = startY - Rect[OverlapIdx].y[0];
                    RectMoveDotDiff.x[1] = Rect[OverlapIdx].x[1] - startX;
                    RectMoveDotDiff.y[1] = Rect[OverlapIdx].y[1] - startY;
                    isRectMove = 2;
                }
                // 다른 선택된 것이 있다면, 선택된 것을 "교체" 하고, 1 상태 유지
                else{
                    RectMoveIdx = OverlapIdx;
                    isRectMove = 1;
                }
            }
            isSelectRemove = false;
        }
        /// 없다면, 새로 직사각형을 그리는 이벤트를 시작
        else{
            CurrentDot.x[0] = startX;
            CurrentDot.y[0] = startY;
            isClick = true;
        }
    }

    /// 그 어느 직사각형 내부도 선택 되지 않고, 다른 것이 선택될 경우, 무조건 선택 상태 해제
    if(isSelectRemove === true){
        isRectMove = 0;
    }
    drawAll();
}

function move(e) {
    /// TODO: 모든 마우스 모양 변경은 move 에서만 실행하자 / 쨋든 마우스 모양 넣는 것도 해야함
    /// 마우스 무브 이벤트시 발됭되는 함수
    /// 마우스 무브 이벤트 시 네가지 경우의 수가 있다.
    /// 1. 새로운 점을 그리는 중
    /// 2. 꼭짓점이나 변을 선택하고 수정하는 중
    /// 3. 직사각형을 이동하는 중
    /// 4. 그냥 마우스가 움직이는 중(아무런 이벤트 X)
    let cvs = document.getElementById("canvas_result");
    let ctx = cvs.getContext("2d");
    /// Canvas 에 나타나는 좌표 위치 재계산
    let startX = (e.offsetX * W / cvs.offsetWidth);
    let startY = (e.offsetY * H / cvs.offsetHeight);

    let NearIdx = nearing(startX, startY, false);
    let OverlapIdx = findOverlapIdx(startX, startY);

    if(!isModify && isRectMove!==2 && !isClick) {
        if (NearIdx !== -1) {

            if(MoveNearDot[0]){
                if(MoveNearDot[1]){
                    cvs.style.cursor = "nw-resize";
                }
                else if(MoveNearDot[3]){
                    cvs.style.cursor = "sw-resize";
                }
                else{
                    cvs.style.cursor = "w-resize";
                }
            }
            else if(MoveNearDot[2]){
                if(MoveNearDot[1]){
                    cvs.style.cursor = "ne-resize";
                }
                else if(MoveNearDot[3]){
                    cvs.style.cursor = "se-resize";
                }
                else{
                    cvs.style.cursor = "e-resize";
                }
            }
            else if(MoveNearDot[1]){
                cvs.style.cursor = "n-resize";
            }
            else{
                cvs.style.cursor = "s-resize";
            }

        }
        else if (OverlapIdx !== -1) {
            cvs.style.cursor = "hand";
        }
        else {
            cvs.style.cursor = "crosshair";
        }
    }
    else if (OverlapIdx !== -1 && isRectMove !== 2) {
        cvs.style.cursor = "hand";
    }
    else if (isRectMove === 2) {
        cvs.style.cursor = "move";
    }
    else {
        cvs.style.cursor = "crosshair";
    }

    if(isModify){
        /// Modify 중의 값을 그릴 때, 값을 잠시 변화하기 위해, 원본 저장
        let Original_Rect = { x: [], y: [] };
        Original_Rect.x[0] = Rect[ModifyIdx].x[0];
        Original_Rect.x[1] = Rect[ModifyIdx].x[1];
        Original_Rect.y[0] = Rect[ModifyIdx].y[0];
        Original_Rect.y[1] = Rect[ModifyIdx].y[1];

        if(SelectNearDot[0]||SelectNearDot[2]){
            /// 클릭된 점이 있다면, 점 이동 시, 변화된 것을 표시하기 위해, 매번 다시 그린다
            /// Modify 된 값 중, x 좌표 변화량이 있다면 이를 그린다
            if(!SelectNearDot[0]) ModifyDot.x[0] = Rect[ModifyIdx].x[0];
            else if(!SelectNearDot[2]) ModifyDot.x[0] = Rect[ModifyIdx].x[1];
            ModifyDot.x[1] = startX;
            if(ModifyDot.x[0] > ModifyDot.x[1]){
                tmp = ModifyDot.x[0];
                ModifyDot.x[0] = ModifyDot.x[1];
                ModifyDot.x[1] = tmp;

            }
            Rect[ModifyIdx].x[0] = ModifyDot.x[0];
            Rect[ModifyIdx].x[1] = ModifyDot.x[1];
        }
        if(SelectNearDot[1]||SelectNearDot[3]){
            /// Modify 된 값 중, y 좌표 변화량이 있다면 이를 그린다
            if(!SelectNearDot[1]) ModifyDot.y[0] = Rect[ModifyIdx].y[0];
            else if(!SelectNearDot[3]) ModifyDot.y[0] = Rect[ModifyIdx].y[1];
            ModifyDot.y[1] =startY;
            if(ModifyDot.y[0] > ModifyDot.y[1]){
                tmp = ModifyDot.y[0];
                ModifyDot.y[0] = ModifyDot.y[1];
                ModifyDot.y[1] = tmp;
            }
            Rect[ModifyIdx].y[0] = ModifyDot.y[0];
            Rect[ModifyIdx].y[1] = ModifyDot.y[1];
        }
        drawAll();
        /// 원본 복구
        Rect[ModifyIdx].x[0] = Original_Rect.x[0];
        Rect[ModifyIdx].x[1] = Original_Rect.x[1];
        Rect[ModifyIdx].y[0] = Original_Rect.y[0];
        Rect[ModifyIdx].y[1] = Original_Rect.y[1];
    }
    if(isRectMove === 2){
        /// Rect Move 중의 값을 그릴 때, 값을 잠시 변화하기 위해, 원본 저장
        let Original_Rect = { x: [], y: [] };
        Original_Rect.x[0] = Rect[RectMoveIdx].x[0];
        Original_Rect.x[1] = Rect[RectMoveIdx].x[1];
        Original_Rect.y[0] = Rect[RectMoveIdx].y[0];
        Original_Rect.y[1] = Rect[RectMoveIdx].y[1];

        Rect[RectMoveIdx].x[0] = Math.max( startX - RectMoveDotDiff.x[0], 0);
        Rect[RectMoveIdx].y[0] = Math.max(startY - RectMoveDotDiff.y[0], 0);
        Rect[RectMoveIdx].x[1] = Math.min( startX + RectMoveDotDiff.x[1], W-1);
        Rect[RectMoveIdx].y[1] = Math.min( startY + RectMoveDotDiff.y[1], H-1);
        drawAll();

        /// 원본 복구
        Rect[RectMoveIdx].x[0] = Original_Rect.x[0];
        Rect[RectMoveIdx].x[1] = Original_Rect.x[1];
        Rect[RectMoveIdx].y[0] = Original_Rect.y[0];
        Rect[RectMoveIdx].y[1] = Original_Rect.y[1];
    }
    if(isClick){
        /// 클릭된 점이 있다면, 점 이동 시, 변화된 것을 표시하기 위해, 매번 다시 그린다
        drawAll();
        ctx.beginPath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#00ff00";
        ctx.moveTo(CurrentDot.x[0], CurrentDot.y[0]);
        ctx.lineTo(CurrentDot.x[0], startY);
        ctx.lineTo(startX, startY);
        ctx.lineTo(startX, CurrentDot.y[0]);
        ctx.lineTo(CurrentDot.x[0], CurrentDot.y[0]);
        ctx.stroke();
    }
}

function deleting(e) {
    /// 우클릭 이벤트 발동시 실행되는 함수로, nearing 함수를 실행한 후, 반환 값이 있다면 그 값을 지운다
    /// === 가장 가까이 있는 점이 10px 이하로 가까이 있다면 그 값을 지운다
    let cvs = document.getElementById("canvas_result");
    let ctx = cvs.getContext("2d");
    let startX = (e.offsetX * W / cvs.offsetWidth);
    let startY = (e.offsetY * H / cvs.offsetHeight);

    if(isRectMove === 1) {
        let ret = findOverlapIdx(startX, startY);
        if (Rect[RectMoveIdx].x[0] <= startX && startX <= Rect[RectMoveIdx].x[1] && Rect[RectMoveIdx].y[0] <= startY && startY <= Rect[RectMoveIdx].y[1]) {
            ret = RectMoveIdx;
        }
        if (ret !== -1) {
            for (let i = ret + 1; i < N; i++) {
                Rect[i - 1].x[0] = Rect[i].x[0];
                Rect[i - 1].x[1] = Rect[i].x[1];
                Rect[i - 1].y[0] = Rect[i].y[0];
                Rect[i - 1].y[1] = Rect[i].y[1];
            }
            delete Rect[N];
            N = N - 1;
        }
    }
    else if(isClick){
        isClick = false;
    }
    isRectMove = 0;
    cvs.style.cursor = "crosshair";
    drawAll();
}

function nearing(x, y, isSelect) {
    /// 좌표가 주어지면, EPS px 안쪽이 있는 것 중 가장 가까운 점을 찾는다
    let mini_x = 1000000, mini_x_idx=-1;
    let mini_y = 1000000, mini_y_idx=-1;
    let ret = -1;
    /// 찾을 때, 그 사각형의 4개 좌표(xmin, ymin, xmax, ymax) 중 어느 것이 EPS px 안쪽에 있었는지 기록한다
    /// 찾을 때, 그 사각형의 4개 좌표(xmin, ymin, xmax, ymax) 중 어느 것이 EPS px 안쪽에 있었는지 기록한다
    for( let i = 0; i < N ; i++ )
    {
        for(let j = 0; j <= 1 ; j++ ){
            /// x 좌표가 작은 것으로 갱신, 갱신할 때, y 좌표가 직사각형 범위 안에 있는지 확인
            if( ( Math.abs(Rect[i].x[j]-x) < mini_x ) && Rect[i].y[0] <= y && y <= Rect[i].y[1] ) {
                mini_x = Math.abs(Rect[i].x[j]-x);
                mini_x_idx = i;
            }
            /// y 좌표가 작은 것으로 갱신, 갱신할 때, x 좌표가 직사각형 범위 안에 있는지 확인
            if( ( Math.abs(Rect[i].y[j]-y) < mini_y ) && Rect[i].x[0] <= x && x <= Rect[i].x[1] ) {
                mini_y = Math.abs(Rect[i].y[j]-y);
                mini_y_idx = i;
            }
        }
    }

    /// 가장 작은 x와 y가 둘 다 EPS보다 멀리 있으면, 가장 가까운 점이 없음을 나타내는 -1 반환
    if( mini_x > EPS && mini_y > EPS ){
        return ret; /// -1
    }
    /// 하나만 되면 그 값을 인덱스로
    else if(mini_x > EPS){
        ret = mini_y_idx;
    }
    else if(mini_y > EPS){
        ret = mini_x_idx;
    }
    /// 둘 다 10px 보다 작으면, 둘 중 더 작은 값의 인덱스를 저장
    else{
        if(mini_x < mini_y) ret = mini_x_idx;
        else ret = mini_y_idx;
    }

    /// 선택된 IDX에서 EPS보다 가까이 있는 점을 기록한다 ( 꼭짓점, 변 선택 기능이 여기서 나옴 )
    if(isSelect){
        SelectNearDot = [false, false, false, false];
        for(let i = 0; i <= 1; i++){
            if(Math.abs(Rect[ret].x[i]-x) < EPS ) {
                SelectNearDot[i*2] = true;
            }
            if(Math.abs(Rect[ret].y[i]-y) < EPS ) {
                SelectNearDot[i*2+1] = true;
            }
        }
    }
    else{
        MoveNearDot = [false, false, false, false];
        for(let i = 0; i <= 1; i++){
            if(Math.abs(Rect[ret].x[i]-x) < EPS ) {
                MoveNearDot[i*2] = true;
            }
            if(Math.abs(Rect[ret].y[i]-y) < EPS ) {
                MoveNearDot[i*2+1] = true;
            }
        }
    }

    return ret;
}

function findOverlapIdx(x, y){
    /// 좌표가 주어지면, 겹치는 사각형의 인덱스를 리턴
    for(let i = 0; i < N; i++){
        if( Rect[i].x[0] <= x && x <= Rect[i].x[1] && Rect[i].y[0] <= y && y <= Rect[i].y[1] ) {
            return i;
        }
    }
    return -1;
}

function drawAll() {
    /// 전체를 다시 그리는 함수
    let cvs = document.getElementById("canvas_result");
    let ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    let img_result = document.getElementById('img_result');
    ctx.drawImage(img_result, 0, 0, img_result.width, img_result.height);

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#00ff00";
    for(let i = 0; i < N ; i++ ) {
        ctx.strokeRect(Rect[i].x[0], Rect[i].y[0], Rect[i].x[1]-Rect[i].x[0], Rect[i].y[1]-Rect[i].y[0]);
    }

    if(isRectMove !== 0){
        if(isRectMove === 1) ctx.fillStyle = "darkgreen";
        else if(isRectMove === 2) ctx.fillStyle = "#0000ff";

        ctx.globalAlpha = "0.1";
        ctx.fillRect(Rect[RectMoveIdx].x[0], Rect[RectMoveIdx].y[0], Rect[RectMoveIdx].x[1]-Rect[RectMoveIdx].x[0], Rect[RectMoveIdx].y[1]-Rect[RectMoveIdx].y[0]);
        ctx.globalAlpha = "1.0";
    }

}

function returnRectToJSON() {

    let Timer = new Date() - startTime;
    if(Timer<=300){
        alert("1초 이상 검토하세요");
        return false;
    }

    /// Onsubmit 이벤트가 발동되면 시행되는 함수, iRect 값을 보낸다.
    let iRect = [];
    for(let i = 0; i < N ; i++){
        iRect[i] = {
            x: [], y: []
        };
        iRect[i].x[0] = parseInt(Rect[i].x[0]);
        iRect[i].y[0] = parseInt(Rect[i].y[0]);
        iRect[i].x[1] = parseInt(Rect[i].x[1]);
        iRect[i].y[1] = parseInt(Rect[i].y[1]);
    }

    // alert(iRect[0].x[0]);
    $.ajax({
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify( { filename, iRect }),
        dataType: "json",
        success: function(response) {
        },
        error: function(err) {
        }
    });
}



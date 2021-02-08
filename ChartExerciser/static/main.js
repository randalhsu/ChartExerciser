const DATETIME_FORMAT = 'YYYY/MM/DD HH:mm';

let tickersInfo = {};
let fetchedBars = [];


const chartWidth = Math.floor(document.body.clientWidth * 0.95 / 2);
const chartHeight = Math.floor(chartWidth * 0.8);
//TODO: resize-able

let chartOptions = {
    width: chartWidth,
    height: chartHeight,
    priceScale: {
        position: 'left',
        scaleMargins: {
            top: 0.05,
            bottom: 0.05,
        },
    },
    localization: {
        dateFormat: 'yyyy/MM/dd',
    },
    layout: {
        backgroundColor: '#000000',
        textColor: 'rgba(255, 255, 255, 0.9)',
    },
    grid: {
        vertLines: {
            visible: false,
        },
        horzLines: {
            visible: false,
        },
    },
    crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
    },
    timeScale: {
        rightOffset: 2,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        borderColor: 'rgba(197, 203, 206, 0.8)',
        timeVisible: true,
        secondsVisible: false,
    },
};

const chart1 = LightweightCharts.createChart(document.getElementById('chart1'), chartOptions);
chartOptions.priceScale.position = 'right';
const chart2 = LightweightCharts.createChart(document.getElementById('chart2'), chartOptions);

let mouseOverChart1 = false;
let mouseOverChart2 = false;

function crosshair1SyncHandler(e) {
    if (e.point === undefined) {
        // triggered by mouse leave event
        if (mouseOverChart1) {
            mouseOverChart1 = false;
            chart2.clearCrossHair();
        }
    } else {
        mouseOverChart1 = true;
        let xx = 0;
        if (e.time !== undefined) {
            xx = chart2.timeScale().timeToCoordinate(e.time);
            if (xx === null) {
                xx = chart2.timeScale().timeToCoordinate(e.time - (e.time % 3600));
            }
        }
        const price = candleSeries1.coordinateToPrice(e.point.y);
        const yy = candleSeries2.priceToCoordinate(price);
        chart2.setCrossHairXY(xx, yy, true);
    }
}

function crosshair2SyncHandler(e) {
    if (e.point === undefined) {
        // triggered by mouse leave event
        if (mouseOverChart2) {
            mouseOverChart2 = false;
            chart1.clearCrossHair();
        }
    } else {
        mouseOverChart2 = true;
        let xx = 0;
        if (e.time !== undefined) {
            xx = chart1.timeScale().timeToCoordinate(e.time);
            if (xx === null) {
                xx = chart1.timeScale().timeToCoordinate(e.time - (e.time % 3600));
            }
        }
        const price = candleSeries2.coordinateToPrice(e.point.y);
        const yy = candleSeries1.priceToCoordinate(price);
        chart1.setCrossHairXY(xx, yy, true);
    }
}

chart1.subscribeCrosshairMove(crosshair1SyncHandler);
chart2.subscribeCrosshairMove(crosshair2SyncHandler);


const candleOptions = {
    priceLineVisible: false,
    upColor: 'rgba(255, 255, 255, 1)',
    downColor: 'rgba(37, 41, 48, 1)',
    borderDownColor: 'rgba(126, 131, 140, 1)',
    borderUpColor: 'rgba(126, 131, 140, 1)',
    wickDownColor: 'rgba(126, 131, 140, 1)',
    wickUpColor: 'rgba(126, 131, 140, 1)',
};

const candleSeries1 = chart1.addCandlestickSeries(candleOptions);
const candleSeries2 = chart2.addCandlestickSeries(candleOptions);


function resampleToHourlyBars(data) {
    let result = [];
    const allHours = [...new Set(data.map(bar => Math.floor(bar.time / 3600)))];
    allHours.forEach(hour => {
        const filteredData = data.filter(e => Math.floor(e.time / 3600) === hour);
        if (filteredData.length > 0) {
            let bar = {};
            bar.time = hour * 3600;
            bar.open = filteredData[0].open;
            bar.close = filteredData[filteredData.length - 1].close;
            bar.high = d3.max(filteredData, e => e.high);
            bar.low = d3.min(filteredData, e => e.low);
            result.push(bar);
        }
    });
    return result;
}

function getCurrentChartTime() {
    if (fetchedBars.length > 0) {
        return fetchedBars[fetchedBars.length - 1].time;
    }
    return null;
}


let specifiedDominantSeries = undefined;

function updateSeriesScale(series1, series2, dominantSeries) {
    let series;
    if (dominantSeries === undefined) {
        series = (specifiedDominantSeries === undefined ? series1 : specifiedDominantSeries);
    } else {
        series = dominantSeries;
        specifiedDominantSeries = dominantSeries;
    }
    const chart = (series === series1 ? chart1 : chart2);
    const oneBarTimeMarginInSeconds = (series === series1 ? 3600 : 300);

    const barsInfo = series.barsInLogicalRange(chart.timeScale().getVisibleLogicalRange());
    const filteredData = fetchedBars.filter(
        e => barsInfo.from <= e.time && e.time <= barsInfo.to + oneBarTimeMarginInSeconds * 1000
    );

    const minPrice = d3.min(filteredData, e => e.low);
    const maxPrice = d3.max(filteredData, e => e.high);
    const options = {
        autoscaleInfoProvider: () => ({
            priceRange: {
                minValue: minPrice,
                maxValue: maxPrice,
            },
            margins: {
                above: 5,
                below: 5,
            },
        }),
    };
    series1.applyOptions(options);
    series2.applyOptions(options);
}

function setPriceScalesAutoScale() {
    chart1.priceScale('left').applyOptions({ autoScale: true });
    chart2.priceScale('right').applyOptions({ autoScale: true });
}

function resetAllScales() {
    chart1.timeScale().resetTimeScale();
    chart2.timeScale().resetTimeScale();
    setPriceScalesAutoScale();
    specifiedDominantSeries = undefined;
    updateSeriesScale(candleSeries1, candleSeries2);
}

function registerFitButtonsHandler() {
    document.getElementById('fit-chart1-button').onclick = () => {
        updateSeriesScale(candleSeries1, candleSeries2, candleSeries1);
        setPriceScalesAutoScale();
    }
    document.getElementById('fit-chart2-button').onclick = () => {
        updateSeriesScale(candleSeries1, candleSeries2, candleSeries2);
        setPriceScalesAutoScale();
    }
    document.getElementById('reset-scales-button').onclick = () => {
        resetAllScales();
    }
}


function drawDailyOpenPrice(series1, series2) {
    const localeHourDiff = new Date().getTimezoneOffset() / 60;
    for (let i = fetchedBars.length - 1; i >= 0; --i) {
        const date = new Date(fetchedBars[i].time * 1000);
        //TODO: DST may change hour?
        if ((date.getHours() + localeHourDiff + 24) % 24 === 18 && date.getMinutes() === 0) {
            const dailyOpenPrice = fetchedBars[i].open;
            attachPriceLineToSeries(series1, dailyOpenPrice);
            attachPriceLineToSeries(series2, dailyOpenPrice);
            return;
        }
    }
}

function attachPriceLineToSeries(series, price) {
    if (series.priceLine !== undefined) {
        if (price === series.priceLine.price) {
            return;
        }
        series.removePriceLine(series.priceLine);
    }
    let priceLine = series.createPriceLine({
        price: price,
        color: 'rgba(207, 166, 0, 1)',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
    });
    priceLine.price = price;
    series.priceLine = priceLine;
}

function showMessage(message, timeout = 0) {
    const el = document.getElementById('message');
    el.innerText = message;
    if (timeout > 0) {
        setTimeout(() => el.innerText = '', timeout);
    }
}

function registerChangeTickerHandler() {
    const buttons = document.getElementById('ticker-selector').querySelectorAll('button');
    for (const button of buttons) {
        button.onclick = () => {
            const ticker = button.innerText;
            const currentTickerNode = document.getElementById('current-ticker');
            const currentTicker = currentTickerNode.innerText;
            if (ticker !== currentTicker) {
                fetchedBars = [];
                sendSwitchAction(ticker);
                currentTickerNode.innerText = ticker;
            }
        }
    }
}

function registerCopyDatetimeHandler() {
    const button = document.getElementById('copy-datetime-button');
    button.onclick = () => {
        const string = $('#datetimepicker1').datetimepicker('date').format(DATETIME_FORMAT);
        copyTextToClipboard(string);
    }
}

function copyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    let message = 'Failed to copy!';
    try {
        if (document.execCommand('copy')) {
            message = 'Copied datetime!';
        }
    } catch (error) {
        console.log(error);
    }
    showMessage(message, 1500);
    document.body.removeChild(textArea);
}

function updateDatetimepickerCurrentDatetime(timestamp) {
    //TODO: locale bug when near final bar
    if (typeof timestamp === 'number') {
        $('#datetimepicker1').datetimepicker('date', moment.utc(timestamp * 1000));
    }
}

function updateDatetimepickerRange(ticker) {
    // Reset first, otherwise may get error due to minDate > maxDate
    const veryMinDate = moment.utc(946684800000);
    const veryMaxDate = moment.utc(4102444800000);
    $('#datetimepicker1').datetimepicker('minDate', veryMinDate);
    $('#datetimepicker1').datetimepicker('maxDate', veryMaxDate);

    const localeSecondDiff = new Date().getTimezoneOffset() * 60;
    const minDate = moment.utc((tickersInfo[ticker].minDate + localeSecondDiff) * 1000);
    const maxDate = moment.utc((tickersInfo[ticker].maxDate + localeSecondDiff) * 1000);
    console.log('min', minDate, 'max', maxDate);
    $('#datetimepicker1').datetimepicker('minDate', minDate);
    $('#datetimepicker1').datetimepicker('maxDate', maxDate);
}


const socket = new WebSocket(`ws://${window.location.host}/socket`);

socket.onopen = function (e) {
    initDatetimepicker();
    registerChangeTickerHandler();
    registerCopyDatetimeHandler();
    registerKeyboardEventHandler();
    registerFitButtonsHandler();

    sendInitAction();
    sendSwitchAction('MES');
}

socket.onmessage = function (e) {
    const response = JSON.parse(e.data);
    let hourlyData;
    //console.log(response);
    switch (response.action) {
        case 'init':
            tickersInfo = response.data;
            return;
            break;

        case 'step':
            const bar = response.data[0];
            if (bar.time == getCurrentChartTime()) {
                showMessage('Already reached final bar!', 2000);
                return;
            }
            fetchedBars.push(bar);
            hourlyData = resampleToHourlyBars(fetchedBars);
            candleSeries1.setData(hourlyData);
            candleSeries2.update(bar);
            break;

        case 'stepback':
            // do nothing
            break;

        case 'switch':
        case 'goto':
            const data = response.data;
            const ticker = response.ticker;
            hourlyData = resampleToHourlyBars(data);
            candleSeries1.setData(hourlyData);
            candleSeries2.setData(data);
            fetchedBars = data;

            candleSeries1.applyOptions({
                priceFormat: tickersInfo[ticker],
            });
            candleSeries2.applyOptions({
                priceFormat: tickersInfo[ticker],
            });

            if (response.action === 'switch') {
                updateDatetimepickerRange(ticker);
            }
            break;
    }
    updateSeriesScale(candleSeries1, candleSeries2);
    drawDailyOpenPrice(candleSeries1, candleSeries2);
    updateDatetimepickerCurrentDatetime(getCurrentChartTime());
}

socket.onclose = function (e) {
    console.log('close bye');
}

socket.onerror = function (e) {
    console.log('error bye');
}
//console.log(socket);

function sendInitAction() {
    socket.send(JSON.stringify({ action: 'init' }));
}

function sendStepAction() {
    socket.send(JSON.stringify({ action: 'step' }));
}

function sendStepbackAction(timestamp) {
    socket.send(JSON.stringify({
        action: 'stepback',
        timestamp: timestamp,
    }));
}

function sendSwitchAction(ticker) {
    // Change ticker
    socket.send(JSON.stringify({
        action: 'switch',
        ticker: ticker,
    }));
}

function sendGotoAction(timestamp) {
    // Change time
    socket.send(JSON.stringify({
        action: 'goto',
        timestamp: timestamp,
    }));
}


function registerKeyboardEventHandler() {
    window.addEventListener('keydown', function (event) {
        console.log(`KeyboardEvent: code='${event.code}'`);
        switch (event.code) {
            case 'Space':
            case 'ArrowRight':
                const currentTicker = document.getElementById('current-ticker').innerText;
                const maxDate = tickersInfo[currentTicker].maxDate;
                if (maxDate == getCurrentChartTime()) {
                    showMessage('Already reached final bar!', 2000);
                    return;
                }
                sendStepAction();
                break;

            case 'ArrowLeft':
                if (fetchedBars.length <= 1) {
                    showMessage('Already reached the first bar!', 2000);
                    return;
                }
                fetchedBars.pop();
                hourlyData = resampleToHourlyBars(fetchedBars);
                candleSeries1.setData(hourlyData);
                candleSeries2.setData(fetchedBars);
                sendStepbackAction(getCurrentChartTime());
                break;
        }
    }, true);
}

function initDatetimepicker() {
    $('#datetimepicker1').datetimepicker({
        format: DATETIME_FORMAT,
        dayViewHeaderFormat: 'YYYY/MM',
        stepping: 5,
        sideBySide: true,
        useCurrent: false,
    });

    const datetimepickerInput = document.getElementById('datetimepicker-input');
    datetimepickerInput.addEventListener('blur', (event) => {
        const timestamp = moment.utc(event.target.value, DATETIME_FORMAT).unix();
        if (timestamp !== getCurrentChartTime()) {
            sendGotoAction(timestamp);
        }
    });
    datetimepickerInput.addEventListener('keydown', (event) => {
        if (event.code === 'Enter' || event.code === 'NumpadEnter') {
            event.target.blur();
        }
    });
};

window.onbeforeunload = function () {
    socket.close();
};

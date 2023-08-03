//width height FOR geoEquirectangular
var width = 1000;
var height = 1000;

var projection = d3.geoEquirectangular().translate([width / 2, height / 2]);

var svg = d3.select("svg").attr("width", width).attr("height", height);

let mapGer = './assets/vg1000_topo.json'
let eCharger = './assets/rhein-kreis-neuss-ladesaulen-in-deutschland.json'
let eChargerGeo = './assets/rhein-kreis-neuss-ladesaulen-in-deutschland.geojson'

let chargerData

let canvas = d3.select('#canvas')
let tooltip = d3.select('#tooltip')

const sliderWidth = 300
const sliderCanvasWidth = sliderWidth + 50

var sliderYears = d3
    .sliderHorizontal()
    .min(new Date(2017, 0, 1))
    .max(new Date(2023, 3, 1))
    .tickFormat(d3.timeFormat('%Y'))
    .step(1)
    .width(sliderWidth)
    .ticks(6)
    .on('onchange', (val) => {
        d3.select('#value').text(val);
    });

d3.select('#sliderYears')
    .append('svg')
    .attr('width', sliderCanvasWidth)
    .attr('height', 100)
    .append('g')
    .attr('transform', 'translate(30,30)')
    .call(sliderYears);

const minDate = new Date(2017, 0, 1),
    maxDate = new Date(2023, 3, 1),
    interval = maxDate.getFullYear() - minDate.getFullYear() + 1,
    startYear = minDate.getFullYear();

let dataMonth = []

for (let month = 0; month < 10; month++) {
    if (month % 3 == 0 || month == 0) {
        dataMonth.push(new Date(startYear, month, 1));
    }
}

var sliderMonth = d3
    .sliderHorizontal()
    .min(new Date(2017, 0, 1))
    .max(new Date(2023, 3, 1))
    .tickFormat(d3.timeFormat('%B'))
    .marks(dataMonth)
    .width(sliderWidth)
    .on('onchange', (val) => {
        d3.select('#value').text(val);
    });

d3.select('#sliderMonth')
    .append('svg')
    .attr('width', sliderCanvasWidth)
    .attr('height', 100)
    .append('g')
    .attr('transform', 'translate(30,30)')
    .call(sliderMonth);

//parses the jsonObject variable to a real parsedJsonObject and filters it into an array. 
//In the array we need all the 'kreis_kreisfreie_stadt' attributes
async function filterChargerJson(jsonObject) {
    const arrFiltered = [];
    const arrReduced = [];

    let parsedJsonObject = await d3.json(jsonObject)

    for (const key in parsedJsonObject) {
        if (key == 'features') {
            for (let b = 0; b < parsedJsonObject[key].length; b++) {
                for (const subKey in parsedJsonObject[key][b]) {
                    if (subKey == 'properties') {
                        for (const subSubKey in parsedJsonObject[key][b].properties) {
                            if (subSubKey === 'kreis_kreisfreie_stadt') {
                                arrFiltered.push(parsedJsonObject[key][b].properties[subSubKey])
                            }
                        }
                    }
                }
            }
        }
    }

    //eliminate everything we don't need from the string, for example 'Kreisfreie Stadt'
    arrFiltered.forEach(element => {
        if (element.includes('Kreisfreie Stadt')) {
            arrReduced.push(element.replace('Kreisfreie Stadt ', ''))
        }
        if (element.includes('Landkreis')) {
            arrReduced.push(element.replace('Landkreis ', ''))
        }
        if (element.includes('Landkreis Regionalverband')) {
            arrReduced.push(element.replace('Landkreis Regionalverband ', ''))
        }
        if (element.includes('Stadtkreis')) {
            arrReduced.push(element.replace('Stadtkreis ', ''))
        }
        if (element.includes('Kreis')) {
            arrReduced.push(element.replace('Kreis ', ''))
        }
        if (element.includes('Regionalverband')) {
            arrReduced.push(element.replace('Regionalverband ', ''))
        }
    });
    return arrReduced
}

//
async function filterMapJson(jsonObject) {
    const arrFiltered = [];
    const arrExpanded = [];

    let parsedJsonObject = await d3.json(jsonObject)

    for (const key in parsedJsonObject) {
        if (key === 'objects') {
            for (const subKey in parsedJsonObject[key]) {
                for (const subSubKey in parsedJsonObject[key][subKey]) {
                    if (subSubKey === 'geometries') {
                        parsedJsonObject[key][subKey][subSubKey].forEach(element => {
                            for (const subSubSubKey in element) {
                                if (subSubSubKey === 'properties') {
                                    for (const subSubSubSubKey in element[subSubSubKey]) {
                                        if (subSubSubSubKey === 'GEN') {
                                            arrFiltered.push(element[subSubSubKey][subSubSubSubKey])
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }
    }

    arrFiltered.forEach(element => {
        const countyObject = {
            county: element,
            amount: 0
        };
        arrExpanded.push(countyObject)
    });
    return arrExpanded
}

async function countChargerAmount(eChargerGeo, mapGer) {
    let eChargerGeoArray = await filterChargerJson(eChargerGeo)
    let counties = await filterMapJson(mapGer)

    eChargerGeoArray.forEach(chargerElement => {
        counties.forEach(countiesElement => {
            if (chargerElement == countiesElement.county) {
                countiesElement.amount += 1
            }
        });
    });
    return counties
}

async function drawMap() {
    let chargerAmount = await countChargerAmount(eChargerGeo, mapGer)
    console.log(chargerAmount)

    var bounds = d3.geoBounds(mapData),
        center = d3.geoCentroid(mapData);

    // Compute the angular distance between bound corners
    var distance = d3.geoDistance(bounds[0], bounds[1]),
        scale = height / distance / Math.sqrt(2);

    // Update the projection scale and centroid
    projection.scale(scale).center(center);

    canvas.selectAll('path')
        .data(mapDataFeatures)
        .enter()
        .append('path')
        .attr('d', d3.geoPath().projection(projection))
        .attr('class', 'county')
        .attr('fill', (mapDataItem) => {
            let county = chargerAmount.find((item) => {
                return item.county == mapDataItem.properties.GEN
            })
            let amount = county.amount
            if (amount <= 10) {
                return 'tomato'
            } else if (amount <= 50) {
                return 'orange'
            } else if (amount <= 100) {
                return 'lightgreen'
            } else {
                return 'limegreen'
            }
        })
        .attr('county', (mapDataItem) => {
            return mapDataItem.properties.GEN
        })
        .attr('amount', (mapDataItem) => {
            let county = chargerAmount.find((item) => {
                return item.county == mapDataItem.properties.GEN
            })
            let amount = county.amount
            return amount
        })
        .on('mouseover', (mapDataItem) => {
            tooltip.transition()
                .style('visibility', 'visible')
            let county = chargerAmount.find((item) => {
                return item.county == mapDataItem.properties.GEN
            })

            tooltip.text(county.county + ' - ' + county.amount + ' Ladesäulen')

            tooltip.attr('amount', county.amount)
        })
        .on('mouseout', (mapDataItem) => {
            tooltip.transition()
                .style('visibility', 'hidden')
        })
}

d3.json(mapGer).then(
    (data, error) => {
        if (error) {
            console.log(error)
        } else {
            mapData = topojson.feature(data, data.objects.vg1000_krs)
            //mapData = topojson.feature(data, data.objects.vg1000_bld)
            mapDataFeatures = mapData.features
            console.log('Map Data')
            console.log(mapDataFeatures)
            drawMap()
        }
    }
)
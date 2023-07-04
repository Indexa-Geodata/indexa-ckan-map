import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import municipios from './municipios.json';
import provincias from './provincias.json';
import Papa from 'papaparse';
import 'bootstrap/dist/css/bootstrap.css';
require('dotenv').config()

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const URL_RESOURCES = process.env.REACT_APP_URL_RESOURCES;
mapboxgl.accessToken = MAPBOX_TOKEN;

function getStops(poligonos) {
    const maxValueToPrint = poligonos.features.reduce((maxValue, obj) => {
        return obj.properties.value > maxValue ? obj.properties.value : maxValue;
    }, -Infinity);
    const minValueToPrint = poligonos.features.reduce((maxValue, obj) => {
        return obj.properties.value < maxValue ? obj.properties.value : maxValue;
    }, Infinity);
    return [
        [minValueToPrint, '#ffdac8'],
        [minValueToPrint + ((maxValueToPrint - minValueToPrint) * 1 / 5), '#FFCCCC'],
        [minValueToPrint + ((maxValueToPrint - minValueToPrint) * 2 / 5), '#FF9999'],
        [minValueToPrint + ((maxValueToPrint - minValueToPrint) * 3 / 5), '#FF6666'],
        [minValueToPrint + ((maxValueToPrint - minValueToPrint) * 4 / 5), '#FF3333']
    ];
}
function filterCsvByParams(objects, params, puntero) {
    if (!objects) return null;
    let hasAllParams;
    for (const obj of objects) {
        hasAllParams = true
        for (const key in params) {
            hasAllParams = hasAllParams && obj.includes(params[key]);
        }
        if (hasAllParams) {
            return obj[puntero];
        }
    }
    return 'NaN';
}


function getDimensions(dsd) {
    return [...dsd.data.dataStructures[0].dataStructureComponents.dimensionList.dimensions];
}

function getParamName(codelist) {
    return codelist.name;
}


function getUrnCL(param, dimensions) {
    if (param === "TIME_PERIOD") return param;
    for (const dimension of dimensions) {
        if (dimension.id === param) {
            return dimension.localRepresentation.enumeration;
        }
    }
}

function getCodelist(urn, dsd) {
    if (urn === 'TIME_PERIOD') return { 'name': 'Año' };
    for (const codelist of dsd.data.codelists) {
        if (codelist.links[0].urn === urn) {
            return codelist;
        }
    }
}

function getCodeName(codelist, codeId) {
    if (codelist.name === 'Año') return codeId;
    for (const code of codelist.codes) {
        if (code.id === codeId) {
            return code.name;
        }
    }
}

export default function Map() {
    const map = useRef(null);
    const mapContainer = useRef(null);
    const urlParams = new URLSearchParams(window.location.search);
    const csvLookup = {};
    const csvParams = {};
    const allValues = {};
    const punteros = {};
    let poligonos = {};
    let dsd;
    const [legendValues, setLegendValues] = useState([]);

    useEffect(() => {
        if (map.current) return;
        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-5.984040411639227, 37.38862867862967],
            zoom: 7.0
        });
    }, []);

    useEffect(() => {
        if (!map.current) return;
        const dataset = urlParams.get('dataset');
        const resourceCsv = urlParams.get('resource-csv');
        const fileNameCsv = urlParams.get('file-name-csv');
        const urlCsv = `${URL_RESOURCES}${dataset}/resource/${resourceCsv}/download/${fileNameCsv}`;
        const resourceJson = urlParams.get('resource-json');
        const fileNameJson = urlParams.get('file-name-json');
        const urlJson = `${URL_RESOURCES}${dataset}/resource/${resourceJson}/download/${fileNameJson}`;

        const popup = new mapboxgl.Popup({
            closeButton: false
        });

        fetch(urlJson).then(response => response.json()).then(jsonData => { dsd = jsonData; console.log(jsonData); }).catch(error => { console.log(error) });
        fetch(urlCsv)
            .then(response => response.text())
            .then(csvData => {
                Papa.parse(csvData, {
                    complete: function (results) {

                        for (let i = 0; i < results.data[0].length; i++) {
                            let columnName = results.data[0][i];
                            punteros[columnName] = i;
                            if (columnName !== 'TERRITORIO' && columnName !== 'OBS_VALUE') {
                                csvParams[columnName] = results.data[1][i];
                            }
                        }
                        delete csvParams['OBS_STATUS'];
                        poligonos = provincias;
                        const codToKeep = [];
                        for (const poligono of poligonos.features) {
                            codToKeep[codToKeep.length] = poligono.properties.cod;
                        }
                        results.data.forEach(row => {
                            if (codToKeep.indexOf(row[punteros.TERRITORIO]) !== -1) {
                                if (!csvLookup[row[punteros.TERRITORIO]]) csvLookup[row[punteros.TERRITORIO]] = [];
                                csvLookup[row[punteros.TERRITORIO]][csvLookup[row[punteros.TERRITORIO]].length] = row;
                            }
                        });
                        poligonos.features.forEach(obj => {
                            const codMun = obj.properties.cod;
                            obj.properties.value = parseFloat(filterCsvByParams(csvLookup[codMun], csvParams, punteros.OBS_VALUE));
                        });
                        console.log(csvLookup);
                        for (const param in csvParams) {
                            allValues[param] = Array.from(new Set(results.data.map(subArray => subArray[punteros[param]])));
                            allValues[param].shift();
                            allValues[param].pop();
                        }
                    }
                })
            })
            .catch(error => {
                console.error('Error:', error);
            });
        map.current.on('load', () => {
            console.log(poligonos);
            map.current.addSource('dataset-source', {
                'type': 'geojson',
                'data': poligonos,
            });

            map.current.addLayer({
                "id": "dataset-layer-fill",
                "source": 'dataset-source',
                "type": "fill",
                "paint": {
                    "fill-color":
                    {
                        "property": "value",
                        "stops": getStops(poligonos)
                    },
                    "fill-opacity": 0.6
                }
            });
            map.current.addLayer({
                "id": "dataset-layer-line",
                "source": 'dataset-source',
                "type": "line",
                "paint": {
                    "line-width": 2,
                    "line-color": "#000000",
                    "line-opacity": 0.2
                }
            });
            const filter = document.getElementById('filter');
            for (const param in csvParams) {
                if (allValues[param].length <= 1) continue;
                const dimensions = getDimensions(dsd);
                const urnCl = getUrnCL(param, dimensions);
                const codelist = getCodelist(urnCl, dsd);
                const paramName = getParamName(codelist);
                const paramSelect = document.createElement('select');
                paramSelect.toggleAttribute('class', 'form-select');
                paramSelect.toggleAttribute('aria-label', 'Default select example');
                const paramText = document.createElement('p');

                paramSelect.setAttribute('param', param);
                for (const paramValues of allValues[param]) {
                    const option = document.createElement('option');
                    option.setAttribute('code', paramValues);
                    option.textContent = getCodeName(codelist, paramValues);
                    paramSelect.appendChild(option);
                }
                paramText.textContent = paramName;
                paramSelect.addEventListener('change', event => {
                    const selectedOptionTag = event.target.selectedOptions[0];
                    const selectedOption = selectedOptionTag.getAttribute('code');
                    const selectedParam = paramSelect.getAttribute('param');
                    csvParams[selectedParam] = selectedOption;
                    poligonos.features.forEach(obj => {
                        const codMun = obj.properties.cod;
                        obj.properties.value = parseFloat(filterCsvByParams(csvLookup[codMun], csvParams, punteros.OBS_VALUE));
                    });
                    map.current.getSource('dataset-source').setData(poligonos);
                    map.current.setPaintProperty('dataset-layer-fill', 'fill-color', {
                        "property": "value",
                        "stops": getStops(poligonos)
                    });
                });
                filter.appendChild(paramText);
                filter.appendChild(paramSelect);
            }
        });
        map.current.on('mousemove', 'dataset-layer-fill', (e) => {
            map.current.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            popup
                .setLngLat(e.lngLat)
                .setHTML(`<p>${feature.properties.nombre}<p/><p>${feature.properties.value}<p/>`
                )
                .addTo(map.current);

        });
        map.current.on('mouseleave', 'dataset-layer-fill', () => {
            map.current.getCanvas().style.cursor = '';
            popup.remove();
        });
    }, []);
    return (
        <div>
            <div ref={mapContainer} className="map-container" id='map-container' />
            <div className="filter" id="filter" />
            <nav className="legend" id="legend" >
                <span style={{'background':'#ffdac8'}}></span>
                <span style={{'background':'#FFCCCC'}}></span>
                <span style={{'background':'#FF9999'}}></span>
                <span style={{'background':'#FF6666'}}></span>
                <span style={{'background':'#FF3333'}}></span>
                <label>0</label>
                <label>1</label>
                <label>2</label>
                <label>3</label>
                <label>4</label>
            </nav>
        </div>
    );
}
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import municipios from './municipios.json';
import provincias from './provincias.json';
import Papa from 'papaparse';
import { getStops, getDimensions, getUrnCL, getCodelist, getParamName, getCodeName, getPunteros, getCodToKeep, getAllValues, populatePoligonos, updateMap, getValueMapping, getUrnEcConceptId, getConceptName, getConceptScheme } from './Utils';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const URL_RESOURCES = process.env.REACT_APP_URL_RESOURCES;
mapboxgl.accessToken = MAPBOX_TOKEN;

export default function Map() {
    const map = useRef(null);
    const mapContainer = useRef(null);
    const urlParams = new URLSearchParams(window.location.search);
    const csvLookup = {};
    const csvParams = {};
    let allValues = {};
    let punteros = {};
    let dsd = {};
    const [legendValues, setLegendValues] = useState([[0], [0], [0], [0], [0]]);
    const [displayValues, setDisplayValues] = useState([[0] , [0], [0], [0], [0]]);
    let poligonos = provincias;
    let territorioName = null;
    let alfaNumerico = false;
    const dataset = urlParams.get('dataset');
    const resourceCsv = urlParams.get('resource-csv');
    const urlCsv = `${URL_RESOURCES}${dataset}/resource/${resourceCsv}/download`;
    const resourceJson = urlParams.get('resource-json');
    const urlJson = `${URL_RESOURCES}${dataset}/resource/${resourceJson}/download`;
    let valueMapping = {};
    // const [stops, setStops] = useState(null );

    useEffect(() => {
        if (!(map.current)) {
            map.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [-4.57566598846433, 37.46330540581251],
                zoom: 7.0
            });
            map.current.addControl(new mapboxgl.NavigationControl());
        }
    }, [map]);

    // useEffect(() =>{
    //     setStops(getStops(poligonos, alfaNumerico));
    //     setLegendValues(stops);
    // }, [poligonos, alfaNumerico]);
    const updateValues = (legendValues) =>{
        console.log(legendValues);

    };

    const fetchJson = (urlJson) => {
        if (Object.keys(dsd) !== 0)
            fetch(urlJson).then(response => response.json()).then(jsonData => { dsd = jsonData; }).catch(error => { console.error(error) });
    };

    const fetchCsv = (urlCsv) => {
        if (Object.keys(allValues) !== 0)
            fetch(urlCsv)
                .then(response => response.text())
                .then(csvData => {
                    Papa.parse(csvData, {
                        complete: function (results) {
                            punteros = getPunteros(results);
                            for (const puntero in punteros) {
                                if (puntero.includes('TERRITORIO'))
                                    territorioName = puntero;
                                if (!puntero.includes('TERRITORIO') && puntero !== 'OBS_VALUE') {
                                    csvParams[puntero] = results.data[1][punteros[puntero]];
                                }
                                if (puntero === 'OBS_VALUE') {
                                    if (isNaN(parseFloat(results.data[1][punteros[puntero]])))
                                        alfaNumerico = true;
                                }
                            }
                            const codToKeep = getCodToKeep(municipios, provincias);
                            results.data.forEach(row => {
                                if (codToKeep.indexOf(row[punteros[territorioName]]) !== -1) {
                                    if (!csvLookup[row[punteros[territorioName]]]) csvLookup[row[punteros[territorioName]]] = [];
                                    csvLookup[row[punteros[territorioName]]][csvLookup[row[punteros[territorioName]]].length] = row;
                                }
                            });
                            const firstPolygon = Object.keys(csvLookup)[0];
                            let dataHasProvincias = false;
                            for (const provincia of provincias.features) {
                                if (provincia.properties.cod === firstPolygon) {
                                    dataHasProvincias = true;
                                    break;
                                }
                            }
                            if (dataHasProvincias) {
                                poligonos = provincias;
                            } else {
                                poligonos = municipios;
                            }
                            if (alfaNumerico) {
                                valueMapping = getValueMapping(results.data.map(obj => obj[punteros.OBS_VALUE]));
                            }
                            populatePoligonos(poligonos, csvLookup, csvParams, punteros, alfaNumerico, valueMapping);
                            allValues = getAllValues(csvParams, results, punteros);
                        }
                    })
                })
                .catch(error => {
                    console.error('Error:', error);
                });
    };

    const createFilters = () => {
        const filter = document.getElementById('filter');
        const childElements = Array.from(filter.childNodes).filter(node => node.nodeType === Node.ELEMENT_NODE);
        if (childElements.length > 2) return;
        for (const param in csvParams) {
            if (allValues[param].length <= 1) continue;
            const dimensions = getDimensions(dsd);
            const urnCl = getUrnCL(param, dimensions);
            const [urnEc, conceptId] = getUrnEcConceptId(param, dimensions);
            const conceptScheme = getConceptScheme(urnEc, dsd);
            const conceptName = getConceptName(conceptScheme, conceptId);
            const codelist = getCodelist(urnCl, dsd);
            const paramName = getParamName(codelist);
            if (conceptName === null) console.log(urnEc);
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
            paramText.textContent = `${conceptName}:`;
            paramSelect.addEventListener('change', event => {
                const selectedOptionTag = event.target.selectedOptions[0];
                const selectedOption = selectedOptionTag.getAttribute('code');
                const selectedParam = paramSelect.getAttribute('param');
                csvParams[selectedParam] = selectedOption;

                populatePoligonos(poligonos, csvLookup, csvParams, punteros, alfaNumerico, valueMapping);
                updateMap(poligonos, map, setLegendValues, alfaNumerico, valueMapping);
            });

            filter.appendChild(paramText);
            filter.appendChild(paramSelect);
        }
    };
    useEffect(() => {
        if (!map.current) return;
        fetchJson(urlJson);
        fetchCsv(urlCsv);
        if (!dsd) return;
        if (!csvLookup) return;
        const popup = new mapboxgl.Popup({
            closeButton: false
        });
        map.current.on('load', () => {
            createFilters();
            let stops;
            if (alfaNumerico){
                const aux = getStops(poligonos, alfaNumerico, valueMapping);
                stops = []
                const legendValueAux = []
                for (const stop of aux){
                    stops.push([stop[0], stop[1]]);
                    legendValueAux.push([stop[2],stop[1]]);
                }
                setLegendValues(legendValueAux);

            }else{
            stops = getStops(poligonos, alfaNumerico, valueMapping);
            setLegendValues(stops);
            }
            
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
                        "stops": stops
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

        });
        map.current.on('mousemove', 'dataset-layer-fill', (e) => {
            map.current.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0]
            const html = feature.properties.display !== 'NaN' ? `<p>${feature.properties.nombre}</p><p>${feature.properties.display}</p>` : `<p>${feature.properties.nombre}</p>`;
            popup
                .setLngLat(e.lngLat)
                .setHTML(html)
                .addTo(map.current);

        });
        map.current.on('mouseleave', 'dataset-layer-fill', () => {
            map.current.getCanvas().style.cursor = '';
            popup.remove();
        });
    }, [map, dsd, csvLookup, poligonos, allValues, csvParams, alfaNumerico, createFilters, fetchCsv, fetchJson, urlCsv, urlJson, valueMapping]);

    const displayLegend = (legendValues) => {
        return (
            <>
                <div className="colores">
                    {legendValues.map((item) => (
                        <span style={{ 'background': item[1], width: '' + (1 / legendValues.length) * 100 + '%' }}></span>
                    ))}
                </div>
                <div className="labeles">
                    {legendValues.map((item) => (
                        <label style={{ width: '' + (1 / legendValues.length) * 100 + '%' }}> {item[0]}</label>
                    ))}
                </div>
            </>
        );
    };

    return (
        <div>
            <div ref={mapContainer} className="map-container" id='map-container' />
            <div className="filter" id="filter" >
            </div>
            <nav className="legend" id="legend">
                {displayLegend(legendValues)}
            </nav>
        </div>
    );
}
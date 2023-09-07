export function getStops(poligonos) {
    const maxValueToPrint = poligonos.features.reduce((maxValue, obj) => {
        return obj.properties.value > maxValue ? obj.properties.value : maxValue;
    }, -Infinity);
    const minValueToPrint = poligonos.features.reduce((maxValue, obj) => {
        return obj.properties.value < maxValue ? obj.properties.value : maxValue;
    }, Infinity);
    return [
        [Math.round(minValueToPrint * 100) / 100, '#ffdac8'],
        [Math.round((minValueToPrint + ((maxValueToPrint - minValueToPrint) * 1 / 4)) * 100) / 100, '#FFCCCC'],
        [Math.round((minValueToPrint + ((maxValueToPrint - minValueToPrint) * 2 / 4)) * 100) / 100, '#FF9999'],
        [Math.round((minValueToPrint + ((maxValueToPrint - minValueToPrint) * 3 / 4)) * 100) / 100, '#FF6666'],
        [Math.round(maxValueToPrint * 100) / 100, '#FF3333']
    ];
}
function filterCsvByParams(objects, params, puntero) {
    if (!objects) return 'NaN';
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


export function getDimensions(dsd) {
    return [...dsd.data.dataStructures[0].dataStructureComponents.dimensionList.dimensions];
}

export function getParamName(codelist) {
    return codelist.name;
}


export function getUrnCL(param, dimensions) {
    if (param === "TEMPORAL") return param;
    for (const dimension of dimensions) {
        console.log(dimension.id);
        console.log(param);
        if (dimension.id === param) {
            return dimension.localRepresentation.enumeration;
        }
    }
}

export function getCodelist(urn, dsd) {
    if (urn === 'TEMPORAL') return { 'name': 'Periodo' };
    for (const codelist of dsd.data.codelists) {
        if (codelist.links[0].urn === urn) {
            return codelist;
        }
    }
}

export function getCodeName(codelist, codeId) {
    if (codelist.name === 'Periodo') return codeId;
    for (const code of codelist.codes) {
        if (code.id === codeId) {
            return code.name;
        }
    }
}

export function getPunteros(results) {
    const punteros = {};
    for (let i = 0; i < results.data[0].length; i++) {
        let columnName = results.data[0][i];
        punteros[columnName] = i;
    }
    return punteros;
}

export function getCodToKeep(municipios, provincias) {
    const codToKeep = [];
    for (const poligono of municipios.features) {
        codToKeep[codToKeep.length] = poligono.properties.cod;
    }
    for (const poligono of provincias.features) {
        codToKeep[codToKeep.length] = poligono.properties.cod;
    }
    return codToKeep;
}

export function getAllValues(csvParams, results, punteros) {
    const allValues = {};
    for (let param of Object.keys(csvParams)) {
        allValues[param] = Array.from(new Set(results.data.map(subArray => subArray[punteros[param]])));
        allValues[param].shift();
        allValues[param].pop();
    }
    return allValues;
}

export function populatePoligonos(poligonos, csvLookup, csvParams, punteros) {
    poligonos.features.forEach(obj => {
        const cod = obj.properties.cod;
        const value = parseFloat(filterCsvByParams(csvLookup[cod], csvParams, punteros.OBS_VALUE).replace(',', '.'));
        obj.properties.value = Math.round(value * 100) / 100;
    });
}

export function updateMap(poligonos, map, setLegendValues) {
    const stops = getStops(poligonos);
    map.current.getSource('dataset-source').setData(poligonos);
    setLegendValues(stops);
    map.current.setPaintProperty('dataset-layer-fill', 'fill-color', {
        "property": "value",
        "stops": stops
    });
}
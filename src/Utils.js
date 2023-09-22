import Rainbow from "rainbowvis.js";

export function getStops(poligonos, alfaNumerico, valueMapping) {
    if (alfaNumerico) {
        const rainbow = new Rainbow();
        const uniques = Object.values(valueMapping);

        rainbow.setSpectrum('#ffdac8', '#FF3333');
        rainbow.setNumberRange(0, uniques.length - 1);
        const result = [];
        for (let i = 0; i < uniques.length; i++) {
            result.push([parseFloat(i), '#' + rainbow.colorAt(i)]);
        }
        return result;
    } else {

        const maxValueToPrint = parseFloat(poligonos.features.reduce((maxValue, obj) => {
            return obj.properties.value > maxValue ? obj.properties.value : maxValue;
        }, -Infinity));
        const minValueToPrint = parseFloat(poligonos.features.reduce((maxValue, obj) => {
            return obj.properties.value < maxValue ? obj.properties.value : maxValue;
        }, Infinity));
        const inter = maxValueToPrint - minValueToPrint;
        return [
            [Math.round(minValueToPrint * 100) / 100, '#ffdac8'],
            [Math.round((minValueToPrint + (inter * 0.25)) * 100) / 100, '#FFCCCC'],
            [Math.round((minValueToPrint + (inter * 0.5)) * 100) / 100, '#FF9999'],
            [Math.round((minValueToPrint + (inter * 0.75)) * 100) / 100, '#FF6666'],
            [Math.round(maxValueToPrint * 100) / 100, '#FF3333']
        ];
    }
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
        if (dimension.id === param) {
            return dimension.localRepresentation.enumeration;
        }
    }
}

export function getUrnEcConceptId(param, dimensions) {
    if (param === "TEMPORAL") return [param, param];
    for (const dimension of dimensions) {
        if (dimension.id === param) {
            const fullUrn = dimension.conceptIdentity;
            const lastPointIndex = fullUrn.lastIndexOf('.');
            return [fullUrn.substring(0, lastPointIndex).replace('conceptscheme.Concept=', 'conceptscheme.ConceptScheme='), fullUrn.substring(lastPointIndex + 1)];
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

export function getConceptScheme(urn, dsd) {
    if (urn === 'TEMPORAL') return { 'name': 'Periodo' };
    for (const cs of dsd.data.conceptSchemes) {
        if (cs.links[0].urn === urn) {
            return cs;
        }
    }
}
export function getConceptName(conceptScheme, conceptId) {
    if (conceptScheme.name === 'Periodo') return 'Periodo';
    for (const concept of conceptScheme.concepts) {
        if (concept.id === conceptId) {
            return concept.name;
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

export function getValueMapping(results) {
    let uniques;
    const valueMapping = {};
    uniques = Array.from(new Set(results));
    uniques.shift();
    uniques.pop();
    for (let i = 0; i < uniques.length; i++) {
        valueMapping[i] = uniques[i];
    }
    return valueMapping;
}

export function populatePoligonos(poligonos, csvLookup, csvParams, punteros, alfaNumerico, valueMapping) {
    const valueInverse = {};
    for (const key in valueMapping) {
        valueInverse[valueMapping[key]] = key;
    }
    poligonos.features.forEach(obj => {
        const cod = obj.properties.cod;
        const value = filterCsvByParams(csvLookup[cod], csvParams, punteros.OBS_VALUE).replace(',', '.');
        if (alfaNumerico) {
            obj.properties.value = parseInt(valueInverse[value]);
            obj.properties.display = value;
        } else {
            obj.properties.value = Math.round(parseFloat(value) * 100) / 100;
            obj.properties.display = obj.properties.value;
        }
    });
}

export function updateMap(poligonos, map, setLegendValues, alfaNumerico, valueMapping) {
    const stops = getStops(poligonos, alfaNumerico, valueMapping);
    map.current.getSource('dataset-source').setData(poligonos);
    setLegendValues(stops);
    map.current.setPaintProperty('dataset-layer-fill', 'fill-color', {
        "property": "value",
        "stops": stops
    });
}
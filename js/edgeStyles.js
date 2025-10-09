// edgeStyles.js

export const EDGE_TYPE_PLAIN = 'plain';
export const EDGE_TYPE_DASHED = 'dashed';

export function edgeMappings() {
    return {
        [EDGE_TYPE_PLAIN]: {
            paintStyle: { stroke: '#007BFF', strokeWidth: 2 },
            connectorStyle: { stroke: '#007BFF', strokeWidth: 2 },
            cssClass: 'plain-connector',
        },
        [EDGE_TYPE_DASHED]: {
            paintStyle: { stroke: '#007BFF', strokeWidth: 2, dashstyle: '4 2' },
            connectorStyle: { stroke: '#007BFF', strokeWidth: 2, dashstyle: '4 2' },
            cssClass: 'dashed-connector',
        },
    };
}

export const STUDY_PLAN = {
    CME: {
        11 : ['FWS100', 'ARL101(A)', 'ENG200', 'CME200', 'STT100', 'MTT102'],
        12:  ['COE102', 'FWS211', 'PHY102', 'PHY102L', 'MTT200', 'CHE205', 'CHE201L', 'CME210'],
        21:  ['MTT201', 'CSC201', 'PHY201', 'ISL100(A)', 'PHY201L', 'COE101', 'CME212'],
        22:  ['MTT204', 'MTT205', 'MEC300', 'CHE206', 'CHE206L', 'CME220'],
        222: ['CME398'],
        31:  ['CHE305', 'CME300', 'CHE330', 'CME341', 'FWS305', 'COE202'],
        32:  ['CME301', 'CME331', 'CME305', 'CME320', 'CME321', 'FWS310'],
        322: ['CME399'],
        41:  ['CME400', 'CME430', 'CME450', 'CME455', 'MEI', 'CME498', 'FWS205'],
        42:  ['CME499', 'MEII', 'MEIII', 'OEI', 'OEII'],
    }
}

export const Electives_Codes = new Set(['MEI', 'MEII', 'MEIII', 'OEI', 'OEII'])
export const Electives_labels = {
    MEI:   'Major Elective I',
    MEII:  'Major Elective II',
    MEIII: 'Major Elective III',
    OEI:   'Open Elective I',
    OEII:  'Open Elective II',
}
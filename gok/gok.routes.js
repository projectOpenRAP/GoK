const cors          =   require('cors');
const bodyParser    =   require('body-parser');

let {
    getFileList,
    getFileData,
    performSearch,
} = require('./gok.controller');

let {
    saveTelemetryData
} = require('./gok.middleware');

module.exports = app => {
    app.use(cors());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    app.get('/gok/file/list', getFileList);
    app.get('/gok/file', saveTelemetryData, getFileData);
    app.get('/gok/file/search', saveTelemetryData, performSearch);

    require('./gok.init.js').initializePlugin();
}

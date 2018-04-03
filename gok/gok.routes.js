const cors          =   require('cors');
const bodyParser    =   require('body-parser');

let {
    getFileList,
    getFileData,
    performSearch,
} = require('./gok.controller');

module.exports = app => {

    app.use(cors());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    app.get('/gok/file/list', getFileList);
    app.get('/gok/file', getFileData);
    app.get('/gok/file/search', performSearch);

    // Initializing plugin    
    require('./gok.init.js').initializePlugin();
}

const path          =   require('path');
const filesdk       =   require('../../../filesdk');
const searchsdk     =   require('../../../searchsdk');
const fs            =   require('fs');
const q             =   require('q');


const mapContentType = {
    '.ico'  : 'image/x-icon',
    '.html' : 'text/html',
    '.js'   : 'text/javascript',
    '.json' : 'application/json',
    '.css'  : 'text/css',
    '.png'  : 'image/png',
    '.jpg'  : 'image/jpeg',
    '.wav'  : 'audio/wav',
    '.mp3'  : 'audio/mpeg',
    '.mp4'  : 'video/mp4',
    '.svg'  : 'image/svg+xml',
    '.pdf'  : 'application/pdf',
    '.doc'  : 'application/msword'
};

let getFileList = (req, res) => {

    let response = {
        success : false,
        data : [],
        message : undefined
    }

    filesdk.readdir(req.query.path)
        .then((fileList) => {
            return prepareDetailedFileList(req.query.path, fileList);
        })
        .then((detailedFileList) => {
            response = { ...response, success : true, data : detailedFileList, message : 'File list retrieved' };
            res.status(200).json(response);
        })
        .catch((error) => {
            response = { ...response, message : error };
            res.status(200).json(response);
        });
}

let prepareDetailedFileList = (parentDirPath, fileList) => {
    let defer = q.defer();

    let eventualDetailedFileList = fileList.filter(file => !(/(^|\/)\.[^\/\.]/g).test(file)).map((file) => {
        let fullFilePath = path.join(parentDirPath, file);

        return getFileInfo(fullFilePath)
            .then((stats) => {
                // Other file details can be added as and when required
                return {
                    name : stats.name,
                    isDirectory : stats.isDirectory
                }
            })
            .catch((error) => {
                return error;
            });
    });

    q.all(eventualDetailedFileList)
        .then((detailedFileList) => {
            defer.resolve(detailedFileList);
        })
        .catch((error) => {
            defer.reject(error);
        });

    return defer.promise;
}

let getFileInfo = (filePath) => {
    let defer = q.defer();

    filesdk.getInfo(filePath)
        .then((stats) => {
            stats = {
                ...stats,
                name : path.basename(filePath),
                isDirectory : stats.isDirectory()
            }

            defer.resolve(stats);
        })
        .catch((error) => {
            defer.reject(error);
        });

    return defer.promise;
}

let getFileData = (req, res) => {

    let response = {
        success : false,
        data : undefined,
        message : undefined
    }

    let filePath = req.query.path;

    filesdk.getInfo(filePath)
        .then((stats) => {
            if(!stats.isDirectory()) {
                try {
                    let extension = path.extname(filePath);

                    res.writeHead(200, {
                        'Content-Type': mapContentType[extension] || 'text/plain',
                        'Content-Disposition': 'inline; filename=\"' + path.basename(filePath) + '\"'
                    });
                    fs.createReadStream(filePath).pipe(res);
                }
                catch(error) {
                    throw error;
                }
            } else {
                throw filePath + ' is a directory.'
            }
        })
        .catch((error) => {
            response = { ...response, message : error };
            res.status(200).json(response);
        });
}

let performSearch = (req, res) => {
    let response = {
        success : false,
        data : undefined,
        message : undefined
    }

    const queryString = req.query.query;

    const regExpQuery = queryString
                            .split(/[\s.-]/)
                            .reduce((temp, item) => {
                                temp.push({
                                    "regexp" : `.*${item.toLowerCase()}.*`,
                                    "field" : "name"
                                })
                                return temp;
                            }, []);

    searchsdk.advancedSearch({
            indexName : 'gok.db',
            query : {
                "disjuncts" :
                    []
                    .concat(regExpQuery)
                    .concat({
                        "match" : queryString,
            			"analyzer" : "standard",
                        "field" : "path"
                    })
            }
        })
        .then((res) => {
            return JSON.parse(res.body).hits.map(item => searchsdk.getDocument({ indexName : item.index, documentID : item.id }));
        })
        .then((promises) => {
            return q.all(promises);
        })
        .then((results) => {
            let cleanedResults = results.map(item => JSON.parse(item.body).fields);

            // To show only folder specific files
            // .filter(item => item.path.startsWith(req.query.path));

            response = { ...response, success : true, data : cleanedResults, message : 'Search hits retrieved.' };
            res.status(200).json(response);
        })
        .catch((error) => {
            response = { ...response, message : error };
            res.status(200).json(response);
        });
}

module.exports = {
    getFileList,
    getFileData,
    performSearch,
    prepareDetailedFileList
}

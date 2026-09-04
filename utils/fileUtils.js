const fs = require("fs");
const path = require("path");

function getPdfFiles(directory) {

    return fs
        .readdirSync(directory)
        .filter(file => file.toLowerCase().endsWith(".pdf"))
        .map(file => path.join(directory, file));

}

module.exports = {
    getPdfFiles
};
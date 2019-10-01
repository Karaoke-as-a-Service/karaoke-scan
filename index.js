const iconvlite = require('iconv-lite');
const walker = require('node-walker');
const child_process = require('child_process');
const fs = require('fs');
const charsetDetector = require("detect-character-encoding");
const splitLines = require('split-lines');

if(process.argv.length < 4) {
	console.error("Usage: " + process.argv[0] + " " + process.argv[1] + " <dir> <outfile>");
	process.exit(0);
}

console.error("Reading", process.argv[2]);

const filetype = /\.txt$/;
const docentry = /^#([^:]+):(.*)$/;
const pathextract = /^(.+\/)[^/]+$/;

let output = [];

let id = 0;

walker(process.argv[2], (errorObject, fileName, fnNext) => {
	if(fileName) {
		if(filetype.test(fileName)) {
			let information = {};
			const buffer = fs.readFileSync(fileName);
			const charset = charsetDetector(buffer).encoding;

			splitLines(iconvlite.decode(buffer,charset)).forEach((line) => {
				if(line[0] === '#') {
					const parsed = line.match(docentry);
					if(parsed) {
						information[parsed[1].toUpperCase()] = parsed[2];
					} else {
						console.error("Failed parsing line of " + fileName + " :", line);
					}
				}
			});

			if(information.MP3) {
				const path = fileName.match(pathextract);
				const result = child_process.spawnSync("ffprobe", ["-show_entries", "format=duration", "-v", "quiet", "-of", "json", path[1] + information.MP3]);
				const mp3info = JSON.parse(result.stdout.toString("utf-8"));
				if(result.status == 0) {
					output.push({
						id,
						title: information.TITLE,
						artist: information.ARTIST,
						language: information.LANGUAGE,
						year: information.YEAR,
						duration: mp3info.format?Number(mp3info.format.duration):undefined
					});
					if(!information.LANGUAGE) {
						console.warn("File " + fileName + " has no language information.");
					}
					id++;
				} else {
					console.error("File " + fileName + " failed.");
				}
			}
		}
		fnNext();
	} else {
		fs.writeFileSync(process.argv[3], JSON.stringify(output));
		console.log("Done! Extracted " + output.length + " tracks.");
	}
});

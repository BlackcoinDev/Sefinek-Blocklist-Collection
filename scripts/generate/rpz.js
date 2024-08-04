const { promises: fs } = require('node:fs');
const path = require('node:path');
const date = require('../functions/date.js');
const sha256 = require('../functions/sha512.js');
const txtFilter = require('../functions/txtFilter.js');
const process = require('../functions/process.js');

const convert = async (folderPath = path.join(__dirname, '../../blocklists/templates'), relativePath = '') => {
	const { format, allFiles, txtFiles, generatedPath } = await txtFilter('rpz', path, fs, relativePath, folderPath);

	await Promise.all(txtFiles.map(async file => {
		const thisFileName = path.join(folderPath, file.name);

		// Cache
		const { cacheHash, stop } = await sha256(thisFileName, format, file);
		if (stop) return;

		// Content
		const fileContent = await fs.readFile(thisFileName, 'utf8');

		const seenDomains = new Set();
		const [, domain] = fileContent.split(' ');
		if (seenDomains.has(domain)) return;

		const replacedFile = fileContent
			.replaceAll(/^(?:127\.0\.0\.1|0\.0\.0\.0) (\S+)/gmu, (_, data) => {
				const rootDomain = data.split('.').slice(-2).join('.');
				seenDomains.add(rootDomain);
				return `${rootDomain} CNAME .\n*.${rootDomain} CNAME .`;
			})
			.replaceAll(/#(?: ?127\.0\.0\.1| ?0\.0\.0\.0) |:: /gmu, '; ')
			.replaceAll(/#/gmu, ';')
			.replace(/〢 /g, '')
			.replace(/<Release>/gim, 'RPZ')
			.replace(/<Version>/gim, date.timestamp)
			.replace(/<LastUpdate>/gim, `${date.full} | ${date.now} | ${date.timezone}`);

		const fullNewFile = path.join(generatedPath, file.name);
		await fs.writeFile(fullNewFile, `$TTL 300\n@ SOA localhost. root.localhost. ${date.timestamp} 43200 3600 259200 300\n  NS  localhost.\n;\n${replacedFile}`);

		console.log(`✔️ ${cacheHash || file.name} ++ ${fullNewFile}`);
	}));

	await process(convert, allFiles, path, relativePath, folderPath);
};

const run = async () => {
	await convert();
	console.log('\n');
};

(async () => await run())();

module.exports = run;
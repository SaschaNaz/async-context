async function loadListFile() {
    let listFileDirectory = "../test-server/list.json";
    let fetched = await fetch(listFileDirectory);
    return await fetched.json() as string[];
}

function importTests(...fileNames: string[]) {
    return Promise.all(fileNames.map(name => System.import(`../test/${name}`)));
}

(async () => {
    let list = await loadListFile();
    await importTests(...list);
    mocha.run();
})().catch((err) => console.error(err));
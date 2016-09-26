import {proposerServiceFactory} from "../src/gryadka/ProposerServiceFactory"

const settings = JSON.parse(require("fs").readFileSync(process.argv[2]));
console.info(settings);

proposerServiceFactory(settings);
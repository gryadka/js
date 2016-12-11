
export class Proxy {
    static chain(...factories) {
        return service => {
            const services = [...factories];
            let x = service;
            while (services.length > 0) {
                x = services.pop()(x);
            }
            return x;
        };
    }
}



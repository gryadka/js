var blessed = require('blessed');
 

export class TUI {
    constructor() {
        this.CMD = "CMD: "
        this.clients = [];
        this.ui = {};
        this.inputHandlers = [];
        this.ui.screen = blessed.screen({
            smartCSR: true,
            cursor: {
                artificial: true,
                shape: 'line',
                blink: true,
                color: null // null for default
            }
        });
        this.ui.log = blessed.log({
            parent: this.ui.screen,
            label: "Log",
            width: '65%',
            height: '100%-1',
            top:0,
            border: {
                type: 'line'
            }
        });
        this.ui.clients = blessed.box({
            parent: this.ui.screen,
            label: "Clients",
            width: '35%',
            height: '100%-1',
            left:'65%',
            top:0,
            border: {
                type: 'line'
            }
        });
        blessed.text({
            top:"100%-1",
            parent: this.ui.screen,
            fg: 'cyan',
            content: this.CMD
        });
        this.ui.commandline = blessed.textbox({
            top:"100%-1",
            parent: this.ui.screen,
            name:'program',
            inputOnFocus: true,
            value: "",
            left: this.CMD.length + 1
        });

        this.ui.commandline.focus();
        this.ui.screen.render();


        this.ui.commandline.key('enter', (ch, key) => {
            const cmd = this.ui.commandline.value;
            this.ui.commandline.clearValue();
            this.ui.commandline.focus();
            
            for (const handler of this.inputHandlers) {
                handler(cmd);
            }
        });

        this.ui.screen.key(['escape','C-c'], () => {
            this.ui.screen.leave();
            process.exit(0);
        });
    }
    onInput(handler) {
        this.inputHandlers.push(handler);
    }
    log(msg) {
        this.ui.log.log(msg);
    }
    stop() {
        this.ui.screen.destroy();
    }
    addclient({title, isactive, tries, writes}) {
        const idx = this.clients.length;
        
        const label = blessed.text({
            top: 3*idx,
            parent: this.ui.clients,
            fg: 'cyan',
            content: title
        });
        var triesLabel = blessed.text({
            top: 3*idx + 1,
            left: 4,
            parent: this.ui.clients,
            fg: 'white',
            content: "Tries"
        });
        var triesValue = blessed.text({
            top:3*idx + 1,
            left:11,
            parent: this.ui.clients,
            fg: 'orange',
            content: "" + tries
        });
        var writesLabel = blessed.text({
            top: 3*idx + 2,
            left: 4,
            parent: this.ui.clients,
            fg: 'white',
            content: "Writes"
        });
        var writesValue = blessed.text({
            top:3*idx + 2,
            left:11,
            parent: this.ui.clients,
            fg: 'orange',
            content: "" + writes
        });

        const handler = {
            title: title,
            activate: () => {},
            deactivate: () => {},
            updateState: (tries, writes) => {
                triesValue.content = "" + tries;
                writesValue.content = "" + writes;
            }
        };

        this.clients.push(handler);
        return handler;
    }
}



// const tui = new TUI();

// const handler = tui.addclient({title: "c0", isactive: true, tries: 847, writes: 42});
// tui.addclient({title: "c1", isactive: false, tries: 531, writes: 22});
// tui.onInput(msg => tui.log(msg));

// setTimeout(function() {
//    handler.updateState(1379, 73); 
// }, 2000);

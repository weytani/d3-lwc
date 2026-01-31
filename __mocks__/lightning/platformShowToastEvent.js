/**
 * Mock for lightning/platformShowToastEvent
 */
export class ShowToastEvent extends CustomEvent {
    constructor(config) {
        super('lightning__showtoast', { detail: config });
        this.title = config.title;
        this.message = config.message;
        this.variant = config.variant;
    }
}

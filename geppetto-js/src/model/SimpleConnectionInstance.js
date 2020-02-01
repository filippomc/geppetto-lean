import ASimpleInstance from './ASimpleInstance';
import Resources from "../Resources";

export default class SimpleConnectionInstance extends ASimpleInstance {
  constructor (node, parent) {
    super(node, parent);
    this.a = node.a;
    this.b = node.b;
  }
  /**
   * Populate connections
   */
  populateConnections () {

    if (this.a.$ref === undefined) {
      // Already populated
      return;
    }

    const a = this.geppettoModel.resolve(this.a.$ref);
    if (a) {
      this.a = a;
      this.a.addConnection(this);
    }

    const b = this.geppettoModel.resolve(this.b.$ref);
    if (b) {
      this.b = b;
      this.b.addConnection(this);
    }

    // TODO this is a shortcut to add connections, verify it's equivalent

  }
     
}

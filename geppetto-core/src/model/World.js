import ObjectWrapper from './ObjectWrapper';
import InstanceFactory from "../InstanceFactory";
import ModelFactory from "../ModelFactory";
import SimpleConnectionInstance from "./SimpleConnectionInstance";

export default class World extends ObjectWrapper{
  constructor (world, parent) {
    super({ wrappedObj: world, parent: parent });
    this.instances = InstanceFactory.createStaticInstances(world.instances, parent);
    this.variables = ModelFactory.createVariables(world.variables, this);
  }

  getInstances () {
    return this.instances;
  }

  getVariables () {
    return this.variables;
  }

  getChildren () {
    return this.instances.concat(this.variables);
  }

  populateInstanceReferences () {


    for (let instance of this.getInstances()) {
      if (instance instanceof SimpleConnectionInstance) {
        instance.populateConnections();
      }
    }

  }
}
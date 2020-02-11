/**
 * Client class use to represent a variable.
 *
 * @module model/Variable
 * @author Giovanni Idili
 */

import { extend } from '../Utility';
import Resources from "../Resources";
import ModelFactory from "../ModelFactory";
import Type from "./Type";
import AParameterCapability from "../capabilities/AParameterCapability";
import AConnectionCapability from "../capabilities/AConnectionCapability";
import InstantiableNode from "./InstantiableNode";

export default class Variable extends InstantiableNode {

  constructor (options) {
    super(options);
    this.anonymousTypes = (options.anonymousTypes !== undefined) ? options.anonymousTypes : [];
    this.types = (options.types !== undefined) ? options.types : [];
    this.pointerValue = options.pointerValue;
    this.capabilities = [];
    this.values = (options.values !== undefined) ? options.values : [];
  }


  /**
   * Get the list of types for this variable
   *
   * @command Variable.getTypes()
   *
   * @returns {List<Type>} - array of types
   *
   */
  getTypes () {
    var types = (this.types !== undefined) ? this.types : [];
    var anonTypes = (this.anonymousTypes !== undefined) ? this.anonymousTypes : [];
    var allTypes = types.concat(anonTypes);
    return allTypes;
  }

  /**
   * Get the list of the anonymous types for this variable
   *
   * @command Variable.getAnonymousTypes()
   *
   * @returns {List<Type>} - array of types
   *
   */
  getAnonymousTypes () {
    return this.anonymousTypes;
  }


  /**
   * Get the type of this variable, return a list if it has more than one
   *
   * @command Variable.getType()
   *
   * @returns List<Type>} - array of types
   *
   */
  getType () {
    var types = this.getTypes();
    if (types.length === 1) {
      return types[0];
    } else {
      return types;
    }
  }

  getValues () {
    return this.values;
  }

  getValue () {
    var values = this.getValues();
    if (values.length === 1) {
      return values[0];
    } else {
      return values;
    }
  }

  /**
   * Get the list of values for this variable
   *
   * @command Variable.getInitialValues()
   *
   * @returns {List<Value>} - array of values
   *
   */
  getInitialValues () {
    var pointerValue = this.pointerValue;
    var values = this.getWrappedObj().initialValues;

    if (values == undefined) {
      values = [];
    }

    // if there is a pointer value just return that
    if (pointerValue !== undefined && pointerValue !== null) {
      values = [pointerValue];
    }

    return values;
  }

  /**
   * Get the initial value for this variable, or a list if more than one
   *
   * @command Variable.getInitialValue()
   *
   * @returns {Value} - array of values
   *
   */
  getInitialValue () {
    var pointerValue = this.pointerValue;
    var values = this.getWrappedObj().initialValues;

    if (values == undefined) {
      values = [];
    }

    // if there is a pointer value just return that
    if (pointerValue !== undefined && pointerValue !== null) {
      values = [pointerValue];
    }

    if (values.length == 1) {
      return values[0];
    } else {
      return values;
    }
  }

  /**
   * Check if the variable is static
   *
   * @command Variable.isStatic()
   *
   * @returns {bool} - Boolean
   *
   */
  isStatic () {
    return this.getWrappedObj().static;
  }

  /**
   * Gets position for the variable
   *
   * @command Variable.isStatic()
   *
   * @returns {Object} - position for the variable
   *
   */
  getPosition () {
    return this.getWrappedObj().position;
  }

  /**
   * Get combined children
   *
   * @command Variable.getChildren()
   *
   * @returns {List<Object>} - List of children
   *
   */
  getChildren () {
    // only anonymousTypes as containment == true in the model (they are not references)
    return this.anonymousTypes;
  }

  /**
   * Extends with methods from another object
   *
   * @command Variable.extendApi(extensionObj)
   */
  extendApi (extensionObj) {
    extend(this, extensionObj);
    this.capabilities.push(extensionObj.capabilityId);
  }

  /**
   * Checks if the instance has a given capability
   *
   * @command Variable.hasCapability(capabilityId)
   *
   * @returns {Boolean}
   */
  hasCapability (capabilityId) {
    var hasCapability = false;
    var capabilities = this.capabilities;

    for (var i = 0; i < capabilities.length; i++) {
      if (capabilities[i] === capabilityId) {
        hasCapability = true;
      }
    }

    return hasCapability;
  }

  /**
   * Get variable capabilities
   *
   * @returns {Array}
   */
  getCapabilities () {
    return this.capabilities;
  }

  // Overriding set
  setTypes (types) {
    this.types = types;
    for (var i = 0; i < types.length; i++) {
      if (types[i].addVariableReference !== undefined) {
        types[i].addVariableReference(this);
      }
    }
    return this;
  }


  /**
   * Resolve connection values
   */
  resolveConnections () {

    // get initial values
    const initialValues = this.getWrappedObj().initialValues;


    // get pointer A and pointer B
    var connectionValue = initialValues[0].value;
    // resolve A and B to Pointer Objects
    var pointerA = ModelFactory.createPointer(connectionValue.a);
    var pointerB = ModelFactory.createPointer(connectionValue.b);

    // set A and B on connection
    this.setA(pointerA);
    this.setB(pointerB);
  }


  populateTypeReferences () {
    super.populateTypeReferences();
    const node = this;

    var types = node.getTypes();
    var referencedTypes = [];
    var hasPointerType = false;
    var swapTypes = true;

    for (const type of types) {
      // check if references are already populated
      if (type instanceof Type) {
        swapTypes = false;
        break;
      }

      // get reference string - looks like this --> '//@libraries.1/@types.5';
      var refStr = type.$ref;

      // if it's anonymous there's no reference
      if (refStr !== undefined) {
        // go grab correct type from Geppetto Model
        var typeObj = node.geppettoModel.resolve(refStr);

        // track if we have pointer type
        if (typeObj.getMetaType() === Resources.POINTER_TYPE) {
          hasPointerType = true;
        }

        // add to list
        referencedTypes.push(typeObj);
        if(typeObj.getVariables !== undefined) {
          for(let variable of typeObj.getVariables()){
            variable.populateTypeReferences();
          }
        }
      }
    }

    if (swapTypes) {
      // set types to actual object references using backbone setter
      node.setTypes(referencedTypes);
    }


    // check if pointer type
    if (hasPointerType) {
      var initialValues = node.getInitialValues();

      if (initialValues !== undefined && initialValues.length === 1) {
        // go to initial values and parse pointer into Pointer with its PointerElements
        var val = initialValues[0];
        var pointer = this.createPointer(val.value);
        // populate pointerValue on variable
        node.pointerValue = pointer;
      } else {
        throw ("The variable " + node.getId() + " does not have initial values. Initial values expected.");
      }
    }

    // add capabilities to variables
    var resolvedTypes = node.getTypes();
    for (var j = 0; j < resolvedTypes.length; j++) {
      if (resolvedTypes[j].getMetaType() === Resources.PARAMETER_TYPE) {
        // if a variable has a Parameter type, add AParameterCapability to the variable
        node.extendApi(AParameterCapability);
      } else if (resolvedTypes[j].getMetaType() === Resources.CONNECTION_TYPE) {
        // if a variable has a connection type, add connection capability
        node.extendApi(AConnectionCapability);
        node.resolveConnectionValues();
      }
    }
  }

  populateShortcutsToChild (child) {
    if (child instanceof Type) {
      // it's an anonymous type we don't want it to be in the path
      child.populateChildrenShortcuts();

      for (let grandChild of child.getChildren()) {
        this[grandChild.getId()] = grandChild;
      }
    }
  }



}

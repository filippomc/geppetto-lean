import GeppettoModel from './model/GeppettoModel';
import Library from './model/Library';
import Type from './model/Type';
import Variable from './model/Variable';
import Value from './model/Value';
import Datasource from './model/Datasource';
import Query from './model/Query';
import CompositeType from './model/CompositeType';
import CompositeVisualType from './model/CompositeVisualType';
import ArrayType from './model/ArrayType';
import ImportType from './model/ImportType';
import ImportValue from './model/ImportValue';
import Instance from './model/Instance';
import ExternalInstance from './model/ExternalInstance';
import ArrayInstance from './model/ArrayInstance';
import ArrayElementInstance from './model/ArrayElementInstance';
import VisualGroup from './model/VisualGroup';
import VisualGroupElement from './model/VisualGroupElement';
import Pointer from './model/Pointer';
import PointerElement from './model/PointerElement';
import SimpleInstance from './model/SimpleInstance';
import SimpleConnectionInstance from './model/SimpleConnectionInstance';
import World from './model/World';
import AVisualCapability from './capabilities/AVisualCapability';
import AVisualGroupCapability from './capabilities/AVisualGroupCapability';
import AConnectionCapability from './capabilities/AConnectionCapability';
import AParameterCapability from './capabilities/AParameterCapability';
import AParticlesCapability from './capabilities/AParticlesCapability';
import AStateVariableCapability from './capabilities/AStateVariableCapability';
import ADerivedStateVariableCapability from './capabilities/ADerivedStateVariableCapability';
import Resources from './Resources';
import { extractMethodsFromObject } from './Utility';
import InstanceFactory from './Instances';
import ModelUtils from "./ModelUtils";

/**
 * @class ModelFactory
 */
class ModelFactory {


  constructor (createTagsCallback) {

    this.createTagsCallback = createTagsCallback ? createTagsCallback : () => undefined;
  }

  /**
   * Creates and populates Geppetto model
   *
   * @param rawModel
   * @param storeModel
   * @param populateRefs - populate type references after model creation
   *
   * @returns {GeppettoModel}
   */
  static createGeppettoModel (rawModel, storeModel = true, populateRefs = true) {
    if (rawModel.eClass !== 'GeppettoModel') {
      throw new Error("Not a geppetto model");
    }
    const geppettoModel = this.createModel(rawModel);

    // create variables
    if (rawModel.variables) {
      console.warn('Geppetto variables are deprecated: use worlds instead.');
      geppettoModel.variables = ModelFactory.createVariables(rawModel.variables, geppettoModel);
    }

    if (rawModel.tags) {
      geppettoModel.tags = rawModel.tags.map(wr => wr.name);
    }

    geppettoModel.libraries = rawModel.libraries.filter(lib => !lib.synched).map(lib => ModelFactory.createLibrary(lib, geppettoModel));


    // create datasources
    geppettoModel.datasources = ModelFactory.createDatasources(rawModel.dataSources, geppettoModel);

    // create top level queries (potentially cross-datasource)
    geppettoModel.queries = ModelFactory.createQueries(rawModel.queries, geppettoModel);

    if (populateRefs) {
      // traverse everything and build shortcuts to children if composite --> containment === true
      geppettoModel.populateChildrenShortcuts();

      // traverse everything and populate type references in variables
      geppettoModel.populateTypeReferences();

      if (geppettoModel.getCurrentWorld()) {
        ModelFactory.initStaticInstances(geppettoModel);
      }

    }


    return geppettoModel;
  }

  static initStaticInstances (geppettoModel) {
    geppettoModel.getCurrentWorld().populateInstanceReferences();
    geppettoModel.updatePaths(geppettoModel.getCurrentWorld().getInstances());
  }

  static createWorld (world, geppettoModel) {
    const w = new World(world, geppettoModel);
    return w;
  }


  /**
   * Creates pointer given a pointer in raw json format
   */
  createPointer (jsonPointer) {

    // get raw pointer elements
    var rawElements = jsonPointer.elements;
    var pointerElements = [];

    // loop elements and create PointerElements (resolving variables / types)
    for (var i = 0; i < rawElements.length; i++) {
      var element = this.createPointerElement(rawElements[i]);
      pointerElements.push(element);
    }

    // create pointer object setting elements
    var pointer = new Pointer({
      "wrappedObj": jsonPointer,
      "elements": pointerElements
    });

    return pointer;
  }

  /**
   * Creates pointer given a pointer in raw json format
   */
  createPointerElement (jsonPointerElement) {
    var variable = this.geppettoModel.resolve(jsonPointerElement.variable.$ref);
    var type = this.geppettoModel.resolve(jsonPointerElement.type.$ref);
    var index = jsonPointerElement.index;

    // create pointer object setting elements
    var pointerElement = new PointerElement({
      "wrappedObj": jsonPointerElement,
      "variable": variable,
      "type": type,
      "index": index
    });

    return pointerElement;
  }

  /**
   * Creates datasources starting from an array of datasources in the json model format
   */
  static createDatasources (jsonDataSources, parent) {
    var dataSources = [];

    if (jsonDataSources !== undefined) {
      for (var i = 0; i < jsonDataSources.length; i++) {
        var ds = ModelFactory.createDatasource(jsonDataSources[i], parent);
        ds.parent = parent;

        dataSources.push(ds);
      }
    }

    return dataSources;
  }

  /**
   * Creates variables starting from an array of variables in the json model format
   */
  static createVariables (jsonVariables, parent) {
    return jsonVariables.filter(rawVariable => !rawVariable.synched).map(rawVariable => ModelFactory.createVariable(rawVariable, parent));

  }

  /**
   * Creates type objects starting from an array of types in the json model format
   */
  static createTypes (jsonTypes, library) {
    var types = [];
 
    if (!jsonTypes) {
      return [];
    }
    return jsonTypes.filter(rawType => !rawType.synched).map((rawType, i) => {
      // check if it's composite type, visual type, array type or simple type
      let type;
      switch (rawType.eClass) {
        case 'CompositeType':
        case 'ConnectionType': {
          type = ModelFactory.createCompositeType(rawType, library);
          break;
        }
        case 'CompositeVisualType': {
          type = ModelFactory.createCompositeVisualType(rawType, library);
          // inject visual capability to all CompositeVisualType
          type.extendApi(AVisualCapability);
          break;
        }
        case 'ImportType': {
          type = ModelFactory.createImportType(rawType, library);
          // we store the index of the importType to speed up swapping procedures
          type._index = i;
          break;
        }
        case 'ArrayType': {
          type = ModelFactory.createArrayType(rawType, library);
          break;
        }
        default: {
          type = ModelFactory.createType(rawType, library);
          // inject visual capability if MetaType === VisualType
          if (type.getMetaType() === Resources.VISUAL_TYPE_NODE) {
            type.extendApi(AVisualCapability);
          }
        }
      }

      // if getVisualType !== null also inject visual capability
      if (type.getVisualType() !== undefined) {
        type.extendApi(AVisualCapability);
      }
      return type;

    });
  }

  newObjectCreated (obj) {
    this.createTagsCallback(obj.getInstancePath ? obj.getInstancePath() : obj.getPath(), extractMethodsFromObject(obj, true));
  }


  /**
   * Merge Geppetto model parameter into existing Geppetto model
   *
   * @param rawModel - raw model to be merged, by deault only adds new vars / libs / types
   * @param geppettoModel
   * @param overrideTypes - bool, mergeModel overrides type
   */
  static mergeModel (rawModel, geppettoModel, overrideTypes = false) {
    this.newPathsIndexing = [];

    // diff object to report back what changed / has been added
    var diffReport = {
      variables: [],
      types: [],
      libraries: [],
      worlds: []
    };

    // STEP 1: create new geppetto model to merge into existing one
    var diffModel = ModelFactory.createGeppettoModel(rawModel, false, false);

    // STEP 2: add libraries/types if any are different (both to object model and json model)
    var diffLibs = diffModel.getLibraries();
    var libs = geppettoModel.getLibraries();

    for (var i = 0; i < diffLibs.length; i++) {
      if (diffLibs[i].getWrappedObj().synched === true) {
        // if synch placeholder lib, skip it
        continue;
      }

      var libMatch = false;

      for (var j = 0; j < libs.length; j++) {
        // if the library exists, go in and check for types diff
        if (diffLibs[i].getPath() === libs[j].getPath()) {
          libMatch = true;

          var diffTypes = diffLibs[i].getTypes();
          var existingTypes = libs[j].getTypes();

          // first loop on types - add new ones
          var addedTypes = [];

          /*
           * the types that need to be swapped in in the first array, the ImportTypes that need to be swapped out in the second one
           * these two arrays are synched by their index
           */
          var typeMatched = [];
          var importTypeMatched = [];

          for (var k = 0; k < diffTypes.length; k++) {
            if (diffTypes[k].getWrappedObj().synched === true) {
              // if synch placeholder type, skip it
              continue;
            }

            var typeMatch = false;

            for (var m = 0; m < existingTypes.length; m++) {
              // check if the given diff type already exists
              if (diffTypes[k].getPath() === existingTypes[m].getPath()) {
                typeMatch = true;
                typeMatched.push(diffTypes[k]);
                importTypeMatched.push(existingTypes[m]);
                break;
              }
            }

            // if the type doesn't exist, append it to the library
            if (!typeMatch) {
              // add to list of types on raw library object
              if (libs[j].getWrappedObj().types === undefined) {
                libs[j].getWrappedObj().types = [];
              }

              libs[j].getWrappedObj().types.push(diffTypes[k].getWrappedObj());

              // add to library in geppetto object model
              libs[j].addType(diffTypes[k]);

              addedTypes.push(diffTypes[k]);


              /*
               * TODO: add potential instance paths
               * NOTE: maybe not needed? the path will be added if a variable uses the type
               */

              // add to diff report
              diffReport.types.push(diffTypes[k]);

              // populate the shortcuts for the added type
              ModelFactory.populateChildrenShortcuts(diffTypes[k]);
              // let's populate the shortcut in the parent of the type, this might not exist if it was a fetch
              diffTypes[k].getParent()[diffTypes[k].getId()] = diffTypes[k];
            }

          }

          for (var k = 0; k < addedTypes.length; k++) {
            // populate references for the new type
            addedTypes[k].populateTypeReferences();
          }

          // second loop on types - override (if flag is set)
          if (overrideTypes) {
            for (var k = 0; k < typeMatched.length; k++) {

              // populate references for the swapped type
              typeMatched[k].populateTypeReferences();
              var index = importTypeMatched[k]._index;

              var variablesToUpdate = importTypeMatched[k].getVariableReferences();
              // swap type reference in ALL variables that point to it
              for (var x = 0; x < variablesToUpdate.length; x++) {
                this.swapTypeInVariable(variablesToUpdate[x], importTypeMatched[k], typeMatched[k]);
              }

              // swap type in raw model
              libs[j].getWrappedObj().types[index] = typeMatched[k].getWrappedObj();

              // store overridden type (so that unresolve type can swap it back)
              typeMatched[k].overrideType = importTypeMatched[k];

              // swap in object model
              typeMatched[k].parent = libs[j];
              libs[j].getTypes()[index] = typeMatched[k];
              // libs[j].removeImportType(importTypeMatched[k]);

              // add potential instance paths
              ModelFactory.addPotentialInstancePathsForTypeSwap(typeMatched[k]);

              // update capabilities for variables and instances if any
              this.updateCapabilities(variablesToUpdate);

              // add to diff report
              diffReport.types.push(typeMatched[k]);

              // populate the shortcuts for the swapped type
              this.populateChildrenShortcuts(typeMatched[k]);
              // let's populate the shortcut in the parent of the type, this might not exist if it was a fetch
              typeMatched[k].getParent()[typeMatched[k].getId()] = typeMatched[k];

            }
          }
        }
      }

      // if the library doesn't exist yet, append it to the model with everything that's in it
      if (!libMatch) {
        if (geppettoModel.getWrappedObj().libraries === undefined) {
          geppettoModel.getWrappedObj().libraries = [];
        }

        // add to raw model
        geppettoModel.getWrappedObj().libraries.push(diffLibs[i].getWrappedObj());

        // add to geppetto object model
        diffLibs[i].parent = geppettoModel;
        geppettoModel.getLibraries().push(diffLibs[i]);

        // add to diff report
        diffReport.libraries.push(diffLibs[i]);

        // populate the shortcuts for the added library
        ModelUtils.populateChildrenShortcuts(diffLibs[i]);
        // let's populate the shortcut in the parent of the library, this might not exist if it was a fetch
        diffLibs[i].getParent()[diffLibs[i].getId()] = diffLibs[i];
      }
    }

    // STEP 3: add variables if any new ones are found (both to object model and json model)

    // STEP 3a: merge old geppettoModel.variables
    let diffVars = diffModel.variables;
    diffReport.variables = ModelFactory.mergeVariables(diffVars, geppettoModel);

    const currentWorld = geppettoModel.getCurrentWorld();
    // STEP 3b: merge world.variables and instances
    if (currentWorld) {
      diffVars = diffModel.getCurrentWorld().getVariables();
      diffReport.worlds = rawModel.worlds.map(world => ({
        ...world,
        variables: [],
        instances: []
      }));

      // TODO handle multiple worlds
      diffReport.worlds[0].variables = diffReport.worlds[0].variables.concat(
        ModelFactory.mergeVariables(diffVars, currentWorld)
      );

      // TODO handle multiple worlds
      diffReport.worlds[0].instances = ModelFactory.mergeSimpleInstances(
        diffModel.getCurrentWorld().getInstances(),
        currentWorld);

      // find new potential instance paths and add to the list

      ModelFactory.initStaticInstances(geppettoModel);

    }

    return diffReport;
  }


  static mergeVariables (diffVars, parent) {
    const currentModelVars = parent.getVariables(true);
    const wrappedObj = parent.wrappedObj;
    const diffReportVars = [];

    for (var x = 0; x < diffVars.length; x++) {
      if (diffVars[x].getWrappedObj().synched === true) {
        // if synch placeholder var, skip it
        continue;
      }

      var match = currentModelVars.find(currModelVar => diffVars[x].getPath() === currModelVar.getPath());

      // if no match, add it, it's actually new
      if (!match) {

        if (wrappedObj.variables === undefined) {
          wrappedObj.variables = [];
        }

        // append variable to raw model
        wrappedObj.variables.push(diffVars[x].getWrappedObj());

        // add variable to geppetto object model
        diffVars[x].parent = parent;
        currentModelVars.push(diffVars[x]);

        // populate references for new vars
        diffVars[x].populateTypeReferences();


        diffReportVars.push(diffVars[x]);

        // populate the shortcuts for the added variable


      }
    }
    parent.populateChildrenShortcuts();
    return diffReportVars;
  }

  /**
   * Merge simple instances
   * @param {*} diffInst wrapped instance objects to be added
   * @param {World} parent - parent container: the world in which the instances are defined
   */
  static mergeSimpleInstances (diffInst, parent) {
    const currentModelInst = parent.getInstances();
    const wrappedObj = parent.wrappedObj;
    const diffReportInst = [];

    for (var x = 0; x < diffInst.length; x++) {
      if (diffInst[x].getWrappedObj().synched === true) {
        // if synch placeholder var, skip it
        continue;
      }

      var match = currentModelInst.find(currModelVar => diffInst[x].getPath() === currModelVar.getPath());

      // if no match, add it, it's actually new
      if (!match) {

        if (wrappedObj.instances === undefined) {
          wrappedObj.instances = [];
        }

        // append variable to raw model
        wrappedObj.instances.push(diffInst[x].getWrappedObj());

        currentModelInst.push(diffInst[x]);


        // populate references for new vars
        diffInst[x].populateTypeReferences();


        diffReportInst.push(diffInst[x]);


        // window.Instances.push(diffInst[x]);
      }
    }
    parent.populateInstanceReferences();
    return diffReportInst;
  }

  /**
   *
   * @param rawModel
   * @param {GeppettoModel} geppettoModel
   * @param overrideTypes
   * @returns {{variables: [], types: [], worlds: [], libraries: []}}
   */
  static mergeValue (rawModel, geppettoModel, overrideTypes = false) {

    this.newPathsIndexing = [];

    // diff object to report back what changed / has been added
    var diffReport = {
      variables: [],
      types: [],
      libraries: [],
      worlds: []
    };
    var diffVars = diffReport.variables;


    // STEP 1: create new geppetto model to merge into existing one
    var diffModel = ModelFactory.createGeppettoModel(rawModel, false, false);

    // STEP 1.5: add world
    if (rawModel.worlds && rawModel.worlds.length) {
      for (let world of rawModel.worlds) {
        if (!world.synched) {
          diffReport.worlds.push(world);
          diffVars = world.variables;
        }
      }
    }


    // STEP 2: add libraries/types if any are different (both to object model and json model)
    var diffLibs = diffModel.getLibraries();
    var libs = geppettoModel.getLibraries();
    var libMatch = false;
    var i = 0, j = 0;
    for (i = 0; i < diffLibs.length; i++) {
      if (diffLibs[i].getWrappedObj().synched === true) {
        continue;
      }
      for (j = 0; j < libs.length; j++) {
        if (diffLibs[i].getPath() === libs[j].getPath()) {
          libMatch = true;
          break;
        }
      }
      if (libMatch) {
        break;
      }
    }
    // diffReport.libraries.push(diffLibs[i]);
    var diffTypes = diffLibs[i].getTypes();
    var existingTypes = libs[j].getTypes();
    var typeMatch = false;
    var k = 0, m = 0;
    for (k = 0; k < diffTypes.length; k++) {
      if (diffTypes[k].getWrappedObj().synched === true) {
        continue;
      }
      for (m = 0; m < existingTypes.length; m++) {
        if (diffTypes[k].getPath() === existingTypes[m].getPath()) {
          typeMatch = true;
          break;
        }
      }
      if (typeMatch) {
        break;
      }
    }
    // diffReport.types.push(diffTypes[k]);
    var diffVars = diffTypes[k].getVariables();
    var vars = existingTypes[m].getVariables();
    var varMatch = false;
    for (var x = 0; x < diffVars.length; x++) {
      if (diffVars[x].getWrappedObj().synched === true) {
        continue;
      }
      for (var y = 0; y < vars.length; y++) {
        if (diffVars[x].getPath() === vars[y].getPath()) {
          varMatch = true;
          diffVars[x].populateTypeReferences();
          vars[y] = diffVars[x];
          diffVars.push(vars[y]); // FIXME variables to worlds
          break;
        }
      }
      if (varMatch) {
        break;
      }
    }
    return diffReport;
  }


  static updateInstancesCapabilities (instances) {
    for (var j = 0; j < instances.length; j++) {
      // check if visual type and inject AVisualCapability
      var visualType = instances[j].getVisualType();
      // check if visual type and inject AVisualCapability
      if ((!(visualType instanceof Array) && visualType !== null && visualType !== undefined)
        || (visualType instanceof Array && visualType.length > 0)) {

        if (!instances[j].hasCapability(Resources.VISUAL_CAPABILITY)) {
          instances[j].extendApi(AVisualCapability);
          ModelUtils.propagateCapabilityToParents(AVisualCapability, instances[j]);

          if (visualType instanceof Array && visualType.length > 1) {
            throw ("Support for more than one visual type is not implemented.");
          }

          // check if it has visual groups - if so add visual group capability
          if ((typeof visualType.getVisualGroups === "function")
            && visualType.getVisualGroups() !== null
            && visualType.getVisualGroups().length > 0) {
            instances[j].extendApi(AVisualGroupCapability);
            instances[j].setVisualGroups(visualType.getVisualGroups());
          }


        }
      }

      // check if it has connections and inject AConnectionCapability
      if (instances[j].getType().getMetaType() === Resources.CONNECTION_TYPE) {
        if (!instances[j].hasCapability(Resources.CONNECTION_CAPABILITY)) {
          instances[j].extendApi(AConnectionCapability);
          instances[j].resolveConnectionValues();
        }
      }

      if (instances[j].getType().getMetaType() === Resources.STATE_VARIABLE_TYPE) {
        if (!instances[j].hasCapability(Resources.STATE_VARIABLE_CAPABILITY)) {
          instances[j].extendApi(AStateVariableCapability);
        }
      }

      if (instances[j].getType().getMetaType() === Resources.DERIVED_STATE_VARIABLE_TYPE) {
        if (!instances[j].hasCapability(Resources.DERIVED_STATE_VARIABLE_CAPABILITY)) {
          instances[j].extendApi(ADerivedStateVariableCapability);
        }
      }

      if (instances[j].getType().getMetaType() === Resources.PARAMETER_TYPE) {
        if (!instances[j].hasCapability(Resources.PARAMETER_CAPABILITY)) {
          instances[j].extendApi(AParameterCapability);
        }
      }

      // getChildren of instance and recurse by the power of greyskull!
      ModelFactory.updateInstancesCapabilities(instances[j].getChildren());
      // this.newObjectCreated(instances[j]); TODO check whether we need this notification
    }
  };

  /**
   * Updates capabilities of variables and their instances if any
   *
   * @param variables
   */
  static updateCapabilities (variables) {
    // some bit of code encapsulated for private re-use
    var that = this;

    // update capabilities for variables
    for (var i = 0; i < variables.length; i++) {
      var resolvedTypes = variables[i].getTypes();
      for (var j = 0; j < resolvedTypes.length; j++) {
        if (resolvedTypes[j].getMetaType() === Resources.PARAMETER_TYPE) {
          // if a variable has a Parameter type, add AParameterCapability to the variable
          if (!variables[i].hasCapability(Resources.PARAMETER_CAPABILITY)) {
            variables[i].extendApi(AParameterCapability);
          }
        } else if (resolvedTypes[j].getMetaType() === Resources.CONNECTION_TYPE) {
          // if a variable has a connection type, add connection capability
          if (!variables[i].hasCapability(Resources.CONNECTION_CAPABILITY)) {
            variables[i].extendApi(AConnectionCapability);
          }
        }
      }

      var varInstances = this.getAllInstancesOf(variables[i]);

      // update instances capabilities
      ModelFactory.updateInstancesCapabilities(varInstances);

      // TODO check whether this is needed
      // if (variables[i] !== null || undefined) {
      //   this.newObjectCreated(variables[i]);
      // }
    }
  }


  /**
   * Given a variable, swap a given type out for another type (recursive on nested types and vars)
   *
   * @param variable
   * @param typeToSwapOut
   * @param typeToSwapIn
   */
  swapTypeInVariable (variable, typeToSwapOut, typeToSwapIn) {
    // ugly but we need the actual arrays stored in the variable as we'll be altering them
    var types = variable.types;
    var anonTypes = variable.anonymousTypes;

    if (types && types.length > 0) {
      this.swapTypeInTypes(types, typeToSwapOut, typeToSwapIn);
    }
    if (anonTypes && anonTypes.length > 0) {
      this.swapTypeInTypes(anonTypes, typeToSwapOut, typeToSwapIn);
    }
  }

  /**
   * Given a set of types, swap a given type out for another type (recursive on nested variables)
   *
   * @param types
   * @param typeToSwapOut
   * @param typeToSwapIn
   */
  swapTypeInTypes (types, typeToSwapOut, typeToSwapIn) {
    for (var y = 0; y < types.length; y++) {
      if (types[y].getMetaType() === typeToSwapOut.getMetaType() && types[y].getId() === typeToSwapOut.getId()) {
        // swap type referenced with the override one
        types[y] = typeToSwapIn;
      } else if (types[y].getMetaType() === Resources.COMPOSITE_TYPE_NODE) {
        // if composite - recurse for each var
        var nestedVars = types[y].getVariables();
        for (var x = 0; x < nestedVars.length; x++) {
          this.swapTypeInVariable(nestedVars[x], typeToSwapOut, typeToSwapIn);
        }
      }
    }
  }


  /**
   * Augment pointer with fully qualified chain to point to a specific instance
   */
  augmentPointer (pointer, connectionInstance) {
    // find root for this branch
    var rootInstance = this.findRoot(connectionInstance);

    // find instance for given pointed variable if any
    var pointedVariable = pointer.getElements()[0].getVariable();
    var pointedIndex = pointer.getElements()[0].getIndex();

    // TODO: this could return potentially more than one match - need to extend to resolve to one
    var matchingInstance = this.findMatchingInstanceByID(pointedVariable.getId(), [rootInstance]);

    // traverse branch and build new array of PointerElements down to instance, given instancepath
    var pointerElements = [];
    var originalElement = pointer.getElements()[0];
    this.buildPointerElementsChain(matchingInstance.getRawInstancePath(), rootInstance, pointerElements, originalElement);

    // horribly override elements with newly created ones
    pointer.elements = pointerElements;

    // add connection instance reference to matching instance for easy retrieval
    if (pointedIndex > -1) {
      matchingInstance.getChildren()[pointedIndex].addConnection(connectionInstance);
    } else {
      matchingInstance.addConnection(connectionInstance);
    }
  }

  /**
   * Build Pointer elements chain
   *
   */
  buildPointerElementsChain (path, instance, pointerElements, originalElement) {
    var instanceIds = path.split('.');

    if (instance.getId() === instanceIds[0]) {
      if (originalElement.getVariable().getId() === instanceIds[0]) {
        // re-use original element
        pointerElements.push(originalElement);
      } else {
        // create pointer element
        var options = {
          "variable": instance.getVariable(),
          "type": instance.getType(),
          "index": undefined
        };
        var pointerEl = new PointerElement(options);
        pointerElements.push(pointerEl);
      }

      // build new path
      var newPath = '';
      for (var i = 0; i < instanceIds.length; i++) {
        if (i !== 0) {
          newPath += (i < (instanceIds.length - 1)) ? (instanceIds[i] + '.') : instanceIds[i];
        }
      }

      // recurse
      if (newPath !== '') {
        var children = instance.getChildren();
        for (var i = 0; i < children.length; i++) {
          this.buildPointerElementsChain(newPath, children[i], pointerElements, originalElement);
        }
      }
    }
    // else do nothing, do not recurse on dead branches
  }


  /** Creates a simple composite */
  static createModel (node, options) {
    if (options === null || options === undefined) {
      options = {
        wrappedObj: node,
        parent: null
      };
    }

    var n = new GeppettoModel(options);

    return n;
  }

  /** Creates a simple composite */
  static createLibrary (node, parent) {
    var n = new Library({
      wrappedObj: node,
      parent: parent
    });
    n.setTypes(ModelFactory.createTypes(node.types, n));
    return n;
  }

  /** Creates a variable */
  static createVariable (node, parent) {
    const options = {
      wrappedObj: node,
      types: node.types
    };

    if (parent !== undefined) {
      options.parent = parent;
    }


    var v = new Variable(options);
    v.values = ModelFactory.createValues(node.initialValues, v);


    // check if it has an anonymous type
    if (node.anonymousTypes !== undefined) {
      v.anonymousTypes = ModelFactory.createTypes(node.anonymousTypes, v);
    }
    return v;
  }

  static createValues (initialValuesObject, variable) {
    var values = [];
    var options;
    if (initialValuesObject !== undefined) {
      for (var i = 0; i < initialValuesObject.length; i++) {
        var value = ModelFactory.createValue(initialValuesObject[i], variable);
        values.push(value);
      }
    }
    return values;
  }

  static createValue (valueNode, parent) {
    const options = {
      wrappedObj: valueNode,
      parent: parent
    };

    if (valueNode.value.eClass === "ImportValue") {
      return new ImportValue(options);
    } else {
      return new Value(options);
    }
  }

  /** Creates a datasource */
  static createDatasource (node, parent) {

    const options = {
      wrappedObj: node,
      parent: parent
    };

    var d = new Datasource(options);

    // create queries
    d.queries = ModelFactory.createQueries(node.queries, d);

    return d;
  }

  /**
   * Create array of client query objects given raw json query objects and a parent
   *
   * @param rawQueries
   * @param parent
   * @returns {Array}
   */
  static createQueries (rawQueries, parent) {
    var queries = [];

    if (rawQueries !== undefined) {
      for (var i = 0; i < rawQueries.length; i++) {
        var q = this.createQuery(rawQueries[i]);
        // set datasource as parent
        q.parent = parent;
        // push query to queries array
        queries.push(q);
      }
    }

    return queries;
  }

  createQuery (node, options) {
    if (options === null || options === undefined) {
      options = { wrappedObj: node };
    }

    var q = new Query(options);

    // set matching criteria
    var matchingCriteriaRefs = node.matchingCriteria;
    if (node.matchingCriteria !== undefined) {
      for (var i = 0; i < matchingCriteriaRefs.length; i++) {
        // get type ref
        var typeRefs = matchingCriteriaRefs[i].type;
        var typesCriteria = [];
        for (var j = 0; j < typeRefs.length; j++) {
          // resolve type ref
          var ref = typeRefs[j].$ref;
          var type = this.geppettoModel.resolve(ref);

          // push to q.matchingCriteria
          if (type instanceof Type) {
            typesCriteria.push(type);
          }
        }

        q.matchingCriteria.push(typesCriteria);
      }
    }

    return q;
  }

  static getRootNode (node) {
    if (!node.parent) {
      return node;
    }
    return ModelFactory.getRootNode(node.parent);
  }

  /** Creates a type */
  static createType (node, library) {

    const t = new Type(node, library);
    if (node.tags) {
      t.tags = node.tags.map(tag => this.geppettoModel.resolve(tag.$ref));
    }
    return t;
  }

  /** Creates an import type */
  createImportType (node, library) {
    var it = new ImportType(node, parent);
    return it;
  }

  /** Creates a composite type */
  static createCompositeType (node, library) {
    var t = new CompositeType(node, library);
    t.variables = ModelFactory.createVariables(t.variables, t);
    return t;
  }

  /** Creates a composite visual type */
  static createCompositeVisualType (node, library) {
    var t = new CompositeVisualType(node, library);
    t.variables = ModelFactory.createVariables(node.variables, t);
    if (node.visualGroups !== undefined) {
      t.visualGroups = ModelFactory.createVisualGroups(node.visualGroups, t);
    }

    return t;
  }

  /** Creates a composite type */
  static createArrayType (node, library) {
    var t = new ArrayType(node, library);
    return t;
  }


  /** Creates an instance */
  static createExternalInstance (path, projectId, experimentId) {
    var options = {
      _metaType: Resources.INSTANCE_NODE,
      path: path,
      projectId: projectId,
      experimentId: experimentId
    };

    return new ExternalInstance(options);
  }


  /** Creates visual groups */
  static createVisualGroups (nodes, parent) {
    var visualGroups = [];

    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].visualGroupElements !== undefined) {
        var options = { wrappedObj: nodes[i] };

        // get tags from raw json abd add to options
        var tagRefObjs = nodes[i].tags;
        if (tagRefObjs !== undefined) {
          var tags = [];

          // populate tags from references
          for (var j = 0; j < tagRefObjs.length; j++) {
            tags.push(this.geppettoModel.resolve(tagRefObjs[j].$ref).name);
          }

          // add to options to init object
          options.tags = tags;
        }

        var vg = new VisualGroup(options);
        vg.parent = parent;
        vg.visualGroupElements = this.createVisualGroupElements(nodes[i].visualGroupElements, vg);

        visualGroups.push(vg);
      }
    }

    return visualGroups;
  }


  /** Creates visual group elements */
  static createVisualGroupElements (nodes, parent) {
    var visualGroupElements = [];

    for (var i = 0; i < nodes.length; i++) {
      var options = {
        wrappedObj: nodes[i],
        parent: parent
      };

      var vge = new VisualGroupElement(options);

      visualGroupElements.push(vge);
    }

    return visualGroupElements;
  }

  /**
   * Clean up state of instance tree
   */
  cleanupInstanceTreeState () {
    // get state variables - clean out time series and watched status
    var stateVariableInstances = this.getAllInstancesOf(Resources.STATE_VARIABLE_TYPE_PATH);
    for (var i = 0; i < stateVariableInstances.length; i++) {
      stateVariableInstances[i].setTimeSeries(null);
      stateVariableInstances[i].setWatched(false, false);
    }
    // get parameters - clean out values
    var parameterInstances = this.getAllInstancesOf(Resources.PARAMETER_TYPE_PATH);
    for (var j = 0; j < parameterInstances.length; j++) {
      parameterInstances[j].setValue(null, false);
    }
  }

  /**
   * Gets all instances with given capability
   *
   * @param capabilityId
   * @returns {Array}
   */
  getAllInstancesWithCapability (capabilityId, instances) {
    var matchingInstances = [];

    // traverse everything and populate matching instances
    for (var i = 0; i < instances.length; i++) {
      if (instances[i].hasCapability(capabilityId)) {
        matchingInstances.push(instances[i]);
      }

      if (typeof instances[i].getChildren === "function") {
        matchingInstances = matchingInstances.concat(this.getAllInstancesWithCapability(capabilityId, instances[i].getChildren()));
      }
    }

    return matchingInstances;
  }


  /**
   * Get all types of given a type (checks inheritance)
   *
   * @param type - Type object or Type path string
   *
   * @returns {Array} - Types
   */
  getAllTypesOfType (type) {
    if (typeof type === 'string' || type instanceof String) {
      // it's an evil string, try to eval as type path in the name of baal
      type = eval(type);
    }

    var types = [];

    // iterate all libraries
    var libraries = this.geppettoModel.getLibraries();
    for (var i = 0; i < libraries.length; i++) {
      // iterate all types within library
      var libraryTypes = libraries[i].getTypes();
      for (var j = 0; j < libraryTypes.length; j++) {
        if (libraryTypes[j] === type) {
          // add if it's a straight match (the type himself)
          types.push(libraryTypes[j]);
        } else if (libraryTypes[j].getSuperType() !== undefined && libraryTypes[j].getSuperType() !== null) {
          // check list of super types
          var superTypes = libraryTypes[j].getSuperType();

          if (!(superTypes instanceof Array)) {
            superTypes = [superTypes];
          }

          for (var w = 0; w < superTypes.length; w++) {
            if (superTypes[w] === type) {
              // add if superType matches
              types.push(libraryTypes[j]);
              // sufficient condition met, break the loop
              break;
            }
          }
        } else {
          // TODO: no immediate matches - recurse on super type and see if any matches if any matches add this type
          /*
           * if(libraryTypes[j].getSuperType() !== undefined && libraryTypes[j].getSuperType() !== null) {
           * var superTypeMatches = this.getAllTypesOfType(libraryTypes[j].getSuperType());
           * if (superTypeMatches.length > 0) {
           * types.push(libraryTypes[j]);
           * }
           * }
           */
        }
      }
    }

    return types;
  }

  /**
   * Gets all variables of the types provided
   *
   * @param typesToSearch
   *
   * @param typeToMatch
   *
   * @returns {Array}
   */
  getAllVariablesOfType (typesToSearch, typeToMatch, recursive) {
    // check if array and if not "make it so"
    if (!(typesToSearch instanceof Array)) {
      typesToSearch = [typesToSearch];
    }

    var variables = [];

    for (var i = 0; i < typesToSearch.length; i++) {
      if (typesToSearch[i].getMetaType() === Resources.COMPOSITE_TYPE_NODE) {
        var nestedVariables = typesToSearch[i].getVariables();
        if (typeToMatch !== undefined && typeToMatch !== null) {
          for (var j = 0; j < nestedVariables.length; j++) {
            var varTypes = nestedVariables[j].getTypes();
            for (var x = 0; x < varTypes.length; x++) {
              if (varTypes[x] === typeToMatch) {
                variables.push(nestedVariables[j]);
              } else if (varTypes[x].getSuperType() !== undefined) {
                // check list of super types
                var superTypes = varTypes[x].getSuperType();

                if (!(superTypes instanceof Array)) {
                  superTypes = [superTypes];
                }

                for (var w = 0; w < superTypes.length; w++) {
                  if (superTypes[w] === typeToMatch) {
                    variables.push(nestedVariables[j]);
                    // sufficient condition met, break the loop
                    break;
                  }
                }
              } else if (varTypes[x].getMetaType() === Resources.COMPOSITE_TYPE_NODE) {
                // check if type is composite and recurse
                variables = variables.concat(this.getAllVariablesOfType([varTypes[x]], typeToMatch));
              }
              if (recursive) {
                this.getAllVariablesOfType(varTypes[x], typeToMatch, recursive, variables);
              }
            }
          }
        } else {
          variables = variables.concat(nestedVariables);
        }
      }
    }

    return variables;
  }


  /**
   * Get top level variables by id
   *
   * @param variableIds
   * @returns {Array}
   */
  getTopLevelVariablesById (variableIds) {
    var variables = [];

    for (var i = 0; i < variableIds.length; i++) {
      if (this.geppettoModel[variableIds[i]] !== undefined) {
        variables.push(this.geppettoModel[variableIds[i]]);
      }
    }

    return variables;
  }

  /**
   * Get matching queries given a type and optional results type
   *
   * @param type
   * @param resultType
   */
  getMatchingQueries (type, resultType) {
    var topLevelQueries = this.geppettoModel.getQueries();
    var matchingQueries = [];

    // iterate top level queries
    for (var k = 0; k < topLevelQueries.length; k++) {
      // check matching criteria first
      if (topLevelQueries[k].matchesCriteria(type)) {
        // if resultType is defined then match on that too
        if (resultType !== undefined) {
          if (resultType === topLevelQueries[k].getResultType()) {
            matchingQueries.push(topLevelQueries[k]);
          }
        } else {
          matchingQueries.push(topLevelQueries[k]);
        }
      }
    }

    return matchingQueries;
  }

  getHTMLVariable (typesToSearch, metaType, identifier) {
    var variables = this.getAllVariablesOfMetaType(typesToSearch, metaType);
    for (var i in variables) {
      if (identifier !== null && identifier !== undefined) {
        if (variables[i].getId() === identifier) {
          return variables[i];
        }
      }
    }

    return null;
  }

  /**
   * Get total count of instances including children
   *
   * @param instances
   */
  getInstanceCount (instances) {
    var count = 0;

    count += instances.length;

    for (var i = 0; i < instances.length; i++) {
      count += this.getInstanceCount(instances[i].getChildren());
    }

    return count;
  }


  /**
   * Unresolve type
   *
   * @param type
   */
  unresolveType (type) {
    var libs = this.geppettoModel.getLibraries();
    var typePath = type.getPath();
    // swap the type with type.overrideType if any is found
    if (type.overrideType !== undefined) {
      // get all types in the current model
      var typeToLibraryMap = [];
      var allTypesInModel = [];
      for (var w = 0; w < libs.length; w++) {
        allTypesInModel = allTypesInModel.concat(libs[w].getTypes());
        for (var v = 0; v < libs[w].getTypes().length; v++) {
          typeToLibraryMap[libs[w].getTypes()[v].getPath()] = libs[w];
        }
      }

      // fetch variables pointing to the old version of the type
      var variablesToUpdate = type.getVariableReferences();

      // swap type reference in ALL variables that point to it
      for (var x = 0; x < variablesToUpdate.length; x++) {
        this.swapTypeInVariable(variablesToUpdate[x], type, type.overrideType);
      }

      // find type in library (we need the index)
      for (var m = 0; m < typeToLibraryMap[typePath].getTypes().length; m++) {
        if (type.getPath() === typeToLibraryMap[typePath].getTypes()[m].getPath()) {
          // swap type in raw model
          typeToLibraryMap[typePath].getWrappedObj().types[m] = type.overrideType.getWrappedObj();

          // swap in object model (this line is probably redundant as the parent hasn't changed)
          type.overrideType.parent = typeToLibraryMap[typePath];
          typeToLibraryMap[typePath].getTypes()[m] = type.overrideType;
        }
      }

      // populate references for the swapped type
      this.populateTypeReferences(type.overrideType);

      // add potential instance paths
      this.case(variablesToUpdate);

      // update capabilities for variables and instances if any
      this.updateCapabilities(variablesToUpdate);
    }
  }





}


export default ModelFactory;

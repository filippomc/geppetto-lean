import ObjectWrapper from "./ObjectWrapper";

export default class InstantiableNode extends ObjectWrapper{
  getInstanceDescriptor () {
    const isStaticVar = this.isStatic();
    return {
      path: this.getPath(),
      metaType: this.getType().getMetaType(),
      type: this.getType().getPath(),
      static: isStaticVar
    };
  }

  isStatic () {
    return false;
  }
}


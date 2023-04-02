export interface SubjectInfo {
  id: number;
  categories: SubjectCategory[];
  imagePath: string;
}

export interface SubjectCategory {
  name: string;
  subcategories: string[];
}

export interface MetaCategories {
  categories: MetaCategory[];
}

export interface MetaCategory {
  name: string;
  type: "radio" | "checkbox";
  subcategories: MetaSubcategory[];
}

export interface MetaSubcategory {
  name: string;
  image: string;
  hidden: boolean;
}

export type Action
  = ActionUpdateSubject
  | ActionListCategories
  | ActionGetTagImagePath
  | ActionGetSubjectInfo
  | ActionGetTotalSubjects
  ;

export type ActionUpdateSubject = { action: "update"; json: SubjectInfo };
export type ActionListCategories = { action: "listCategories" };
export type ActionGetTagImagePath = { action: "getTagImagePath"; category: string; tag: string };
export type ActionGetSubjectInfo = { action: "getSubjectInfo"; id: number };
export type ActionGetTotalSubjects = { action: "getTotalSubjects" };

import { sendAction } from "./api";
import { registerMagnify } from "./magnify";
import { PromiseQueue } from "./promise-queue";
import { SubjectInfo, MetaCategory, MetaCategories, MetaSubcategory } from "./types";

interface TagBox {
  container: HTMLElement;
  input: HTMLInputElement;
  label: HTMLLabelElement;
  subcategory: string;
  hidden: boolean;
}

enum Completion {
  Error,
  NotDone,
  Done,
}

enum TagStatus {
  Invalid,
  Warn,
  Valid,
}

function flashRedScreen() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
  overlay.style.zIndex = '9999';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.2s';
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = '1';
  }, 0);

  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(overlay);
    }, 100);
  }, 150);
}

export class App {
  private readonly _subjectDropdown: HTMLSelectElement;
  private readonly _prevSubjectButton: HTMLButtonElement;
  private readonly _nextSubjectButton: HTMLButtonElement;

  private readonly _categoryDropdown: HTMLSelectElement;
  private readonly _prevCategoryButton: HTMLButtonElement;
  private readonly _nextCategoryButton: HTMLButtonElement;

  private readonly _image: HTMLImageElement;
  private readonly _categoryContainer: HTMLElement;
  private readonly _tagsContainer: HTMLElement;

  private _promiseQueue: PromiseQueue = new PromiseQueue();

  private _allSubjects: SubjectInfo[] = [];
  private _currentSubject: SubjectInfo | null = null;

  private _allCategories: MetaCategory[] = [];
  private _currentCategoryIndex = -1;

  private _currentTagBoxes: TagBox[] = [];
  private _hideHiddenSubcategories = true;

  public constructor() {
    const subjectDropdown = document.getElementById("subject-dropdown") as HTMLSelectElement | null;
    if (!subjectDropdown) throw new Error("Subject dropdown not found");
    this._subjectDropdown = subjectDropdown;

    const prevSubjectButton = document.getElementById("prev-subject-button") as HTMLButtonElement | null;
    if (!prevSubjectButton) throw new Error("Prev subject button not found");
    this._prevSubjectButton = prevSubjectButton;

    const nextSubjectButton = document.getElementById("next-subject-button") as HTMLButtonElement | null;
    if (!nextSubjectButton) throw new Error("Next subject button not found");
    this._nextSubjectButton = nextSubjectButton;

    const categoryDropdown = document.getElementById("category-dropdown") as HTMLSelectElement | null;
    if (!categoryDropdown) throw new Error("Category dropdown not found");
    this._categoryDropdown = categoryDropdown;

    const prevCategoryButton = document.getElementById("prev-category-button") as HTMLButtonElement | null;
    if (!prevCategoryButton) throw new Error("Prev button not found");
    this._prevCategoryButton = prevCategoryButton;

    const nextCategoryButton = document.getElementById("next-category-button") as HTMLButtonElement | null;
    if (!nextCategoryButton) throw new Error("Next button not found");
    this._nextCategoryButton = nextCategoryButton

    const image = document.getElementById("subject-image") as HTMLImageElement | null;
    if (!image) throw new Error("Image not found");
    this._image = image;

    const categoryContainer = document.getElementById("category-container");
    if (!categoryContainer) throw new Error("Category container not found");
    this._categoryContainer = categoryContainer;

    const tagsContainer = document.getElementById("tags-container");
    if (!tagsContainer) throw new Error("Tags container not found");
    this._tagsContainer = tagsContainer;

    this._prevSubjectButton.addEventListener("click", async () => {
      await this._promiseQueue.add(() => this._advanceToPrevSubject());
    });
    this._nextSubjectButton.addEventListener("click", async () => {
      await this._promiseQueue.add(() => this._advanceToNextSubject());
    });
    this._prevCategoryButton.addEventListener("click", async () => {
      await this._promiseQueue.add(() => this._advanceToPrevCategory());
    });
    this._nextCategoryButton.addEventListener("click", async () => {
      await this._promiseQueue.add(() => this._advanceToNextCategory());
    });
    this._subjectDropdown.addEventListener("change", () => this._onDropdownSelection());
    this._categoryDropdown.addEventListener("change", () => this._onDropdownSelection());
  }

  public async init(): Promise<void> {
    const categoriesData = await sendAction({ action: "listCategories" }) as MetaCategories;
    this._allCategories = categoriesData.categories;
    this._sortCategories();
    const totalSubjects = await sendAction({ action: "getTotalSubjects" }) as number;
    if (totalSubjects === 0) {
      await this._displayCompletionMessage();
      return;
    }

    for (let i = 0; i < totalSubjects; ++i) {
      const info = await sendAction({ action: "getSubjectInfo", id: i }) as SubjectInfo;
      this._allSubjects.push(info);
      const option = document.createElement("option");
      option.value = info.id.toString();
      option.text = `${info.imagePath}`;
      this._subjectDropdown.add(option);
    }

    for (const category of this._allCategories) {
      const option = document.createElement("option");
      option.value = category.name;
      option.text = category.name;
      this._categoryDropdown.add(option);
    }

    await this._useImageInfo(0);
    await this._advanceToNextCategory();
    registerMagnify();
  }

  private _sortCategories(): void {
    this._allCategories.sort((a, b) => a.name.localeCompare(b.name));
  }

  private _getCurrentCategory(): MetaCategory {
    const category = this._allCategories[this._currentCategoryIndex];
    if (!category) throw new Error(`Category ${this._currentCategoryIndex} not found`);
    return category;
  }

  private _validateTags(): TagStatus {
    if (this._currentTagBoxes.length === 0) return TagStatus.Invalid;
    const category = this._getCurrentCategory();
    let checkCount = 0;
    let hasRadio = false;
    for (const tagBox of this._currentTagBoxes) {
      if (tagBox.input.checked) {
        ++checkCount;
      }
      if (tagBox.input.type === "radio") {
        hasRadio = true;
      }
      if (!category.subcategories.find(x => x.name === tagBox.subcategory)) {
        console.log(`Tag ${tagBox.subcategory} not found in category ${category.name}. Was the category changed?`)
        return TagStatus.Invalid;
      }
    }
    if (hasRadio && checkCount !== 1) return TagStatus.Invalid;
    if (!hasRadio && checkCount === 0) return TagStatus.Warn;
    return TagStatus.Valid;
  }

  private async _buildCategoryDisplay(categoryIndex: number | null): Promise<void> {
    this._tagsContainer.style.display = "none";
    this._tagsContainer.innerHTML = "";
    if (categoryIndex === null) {
      this._categoryContainer.innerHTML = `<h2>Category: ${null}</h2>`;
      return;
    }

    const category = this._getCurrentCategory();
    this._categoryContainer.innerHTML = `<h2>Category: ${category.name}</h2>`;

    const visibleTags = category.subcategories.filter(x => !x.hidden);
    const hiddenTags = category.subcategories.filter(x => x.hidden);
    this._currentTagBoxes = [];

    const toggleHiddenSubcategoriesButton = document.createElement('button');
    toggleHiddenSubcategoriesButton.textContent = 'Show hidden subcategories';
    toggleHiddenSubcategoriesButton.addEventListener('click', () => {
      this._hideHiddenSubcategories = !this._hideHiddenSubcategories;
      this._updateHiddenTagVisibilities();
      if (this._hideHiddenSubcategories) {
        toggleHiddenSubcategoriesButton.textContent = 'Show hidden subcategories';
      }
      else {
        toggleHiddenSubcategoriesButton.textContent = 'Hide hidden subcategories';
      }
    });

    const goTags = async (tags: MetaSubcategory[]) => {
      for (const tag of tags) {
        const tagBox = await this._buildTagDisplay(tag);
        this._currentTagBoxes.push(tagBox);
      }
    }
    await goTags(visibleTags);
    if (false as boolean) {
      this._tagsContainer.appendChild(toggleHiddenSubcategoriesButton);
    }
    else {
      this._tagsContainer.appendChild(document.createElement('button'));
    }
    await goTags(hiddenTags);

    this._updateHiddenTagVisibilities();
    this._tagsContainer.style.display = "";
  }

  private async _buildTagDisplay(subcategory: MetaSubcategory): Promise<TagBox> {
    const currentImage = this._currentSubject;
    if (!currentImage) throw new Error("No current image");
    const category = this._getCurrentCategory();

    const tagImagePath = await sendAction({
      action: "getTagImagePath",
      category: category.name,
      tag: subcategory.name
    }) as string;

    const tagContainer = document.createElement("div");
    tagContainer.className = "tag-container";

    const tagImage = document.createElement("img");
    tagImage.src = `http://localhost:3000/${tagImagePath}`;
    const dim = 150;
    tagImage.style.width = `${dim}px`;
    tagImage.style.height = `${dim}px`;
    tagImage.draggable = false;
    tagContainer.appendChild(tagImage);

    tagContainer.appendChild(document.createElement("br"));

    const tagInput = document.createElement("input");
    tagInput.type = category.type;
    tagInput.name = category.name;
    tagInput.checked = false;
    for (const c of currentImage.categories) {
      if (c.name === category.name) {
        for (const tag of c.subcategories) {
          if (tag === subcategory.name) {
            tagInput.checked = true;
            break;
          }
        }
      }
    }
    tagContainer.appendChild(tagInput);

    const tagLabel = document.createElement("label");
    tagLabel.textContent = subcategory.name;
    tagLabel.htmlFor = subcategory.name;
    tagContainer.appendChild(tagLabel);

    const clickables = [tagLabel, tagImage];
    for (const clickable of clickables) {
      clickable.addEventListener("click", () => {
        if (category.type === "checkbox") {
          tagInput.checked = !tagInput.checked;
        } else if (category.type === "radio") {
          this._currentTagBoxes.forEach((tb) => {
            tb.input.checked = tb.subcategory === subcategory.name;
            tb.label.classList.toggle("active", tb.input.checked);
          });
        }
      });
    }

    this._tagsContainer.appendChild(tagContainer);
    const tagBox: TagBox = {
      container: tagContainer,
      input: tagInput,
      label: tagLabel,
      subcategory: subcategory.name,
      hidden: false // subcategory.hidden
    };
    return tagBox;
  }

  private _updateHiddenTagVisibilities(): void {
    for (const tagBox of this._currentTagBoxes) {
      if (!tagBox.hidden) continue;
      const display = this._hideHiddenSubcategories ? 'none' : 'block';
      tagBox.container.style.display = display;
    }
  }

  private async _useImageInfo(id: number | null): Promise<void> {
    if (id === null) {
      this._currentSubject = null;
      this._image.style.display = "none";
      this._nextCategoryButton.style.display = "none";
      return;
    }
    const info = await sendAction({ action: "getSubjectInfo", id: id }) as SubjectInfo;
    this._currentSubject = info
    this._image.src = `http://localhost:3000/${this._currentSubject.imagePath}`;
  }

  private _decodeSelectedSubject(): number {
    const selectedIndex = this._subjectDropdown.selectedIndex;
    const selectedSubjectId = parseInt(this._subjectDropdown.options[selectedIndex].value, 10);
    return selectedSubjectId;
  }

  private _decodeSelectedCategory(): string {
    const selectedIndex = this._categoryDropdown.selectedIndex;
    const selectedCategoryName = this._categoryDropdown.options[selectedIndex].value;
    return selectedCategoryName;
  }

  private _guardTags(): boolean {
    const tagStatus = this._validateTags();
    if (this._currentCategoryIndex >= 0 && tagStatus === TagStatus.Invalid) {
      console.log("Please select exactly one tag for radio selections");
      flashRedScreen();
      return false;
    }
    if (tagStatus == TagStatus.Warn) {
      console.log("Please select at least one tag");
      flashRedScreen();
      return false;
    }
    return true;
  }

  public async _goToSubjectAndCategory(subjectId: number, categoryKey: number | string, validateTags: boolean): Promise<Completion>;
  public async _goToSubjectAndCategory(subjectId: null, categoryKey: null, validateTags: boolean): Promise<Completion>;
  public async _goToSubjectAndCategory(
    subjectId: number | null,
    categoryKey: number | string | null,
    validateTags: boolean): Promise<Completion> {
    if (validateTags) {
      if (!this._guardTags()) {
        return Completion.Error;
      }
    }

    if (this._currentCategoryIndex >= 0 && this._currentSubject) {
      await this._postUpdateTags();
    }

    if (subjectId === null && categoryKey === null) {
      await this._useImageInfo(null);
      await this._buildCategoryDisplay(null);
      await this._displayCompletionMessage();
      return Completion.Done;
    }
    if (subjectId === null || categoryKey === null) {
      throw new Error(`Invalid subjectId or categoryKey: ${subjectId}, ${categoryKey}`);
    }

    if (subjectId < 0 || subjectId >= this._allSubjects.length) {
      throw new Error(`Invalid subject index: ${subjectId}`);
    }

    const category = typeof categoryKey === "number"
      ? this._allCategories[categoryKey]
      : this._allCategories.find(x => x.name === categoryKey)
      ;
    if (!category) throw new Error(`Invalid category key: ${categoryKey}`);
    const categoryIndex = categoryKey === null ? -1 : this._allCategories.indexOf(category);
    if (categoryIndex < 0) throw new Error(`Invalid category index: ${categoryIndex}`);

    await this._useImageInfo(subjectId);
    this._currentCategoryIndex = categoryIndex;
    await this._buildCategoryDisplay(categoryIndex);

    this._subjectDropdown.selectedIndex = subjectId;
    this._categoryDropdown.selectedIndex = this._allCategories.findIndex(c => c.name === category.name);

    return Completion.NotDone;
  }

  private async _onDropdownSelection(): Promise<void> {
    const subjectId = this._decodeSelectedSubject();
    const categoryKey = this._decodeSelectedCategory();
    await this._goToSubjectAndCategory(subjectId, categoryKey, false);
  }

  private async _advanceToPrevSubject(): Promise<Completion> {
    if (!this._currentSubject) throw new Error("No current subject");
    const id = this._currentSubject.id - 1;

    if (id < 0) {
      console.log("Already at the first image");
      flashRedScreen();
      return Completion.Error;
    }

    return await this._goToSubjectAndCategory(id, 0, false);
  }

  private async _advanceToNextSubject(): Promise<Completion> {
    if (!this._currentSubject) throw new Error("No current subject");
    const id = this._currentSubject.id + 1;

    return await this._goToSubjectAndCategory(id, 0, false);
  }

  private async _advanceToPrevCategory(): Promise<Completion> {
    if (!this._guardTags()) {
      return Completion.Error;
    }
    const prevCategoryIndex = this._currentCategoryIndex - 1;
    if (prevCategoryIndex < 0) {
      if (this._currentSubject && this._currentSubject.id === 0) {
        console.log("Already at the first subject and first category");
        flashRedScreen();
        return Completion.Error;
      }

      const prevImageCompletion = await this._advanceToPrevSubject();
      if (prevImageCompletion === Completion.Error) {
        return Completion.Error;
      }

      const lastCategoryIndex = this._allCategories.length - 1;
      const id = this._currentSubject ? this._currentSubject.id : 0;
      return await this._goToSubjectAndCategory(id, lastCategoryIndex, false);
    }

    const id = this._currentSubject ? this._currentSubject.id : 0;
    return await this._goToSubjectAndCategory(id, prevCategoryIndex, false);
  }

  private async _advanceToNextCategory(): Promise<Completion> {
    const nextCategoryIndex = this._currentCategoryIndex + 1;
    if (nextCategoryIndex >= this._allCategories.length) {
      return await this._advanceToNextSubject();
    }
    const id = this._currentSubject ? this._currentSubject.id : 0;
    return await this._goToSubjectAndCategory(id, nextCategoryIndex, true);
  }

  private async _postUpdateTags(): Promise<void> {
    const currentImage = this._currentSubject;
    if (!currentImage) throw new Error("No current image");
    const category = this._allCategories[this._currentCategoryIndex];
    if (!category) throw new Error("No current category");

    const buildTags = () => {
      const tags: string[] = [];
      for (const tagBox of this._currentTagBoxes) {
        if (!tagBox.input.checked) {
          continue;
        }
        tags.push(tagBox.subcategory);
      }
      return tags;
    };

    let found = false;
    for (let i = 0; i < currentImage.categories.length; ++i) {
      const c = currentImage.categories[i]!;
      if (c.name !== category.name) {
        continue;
      }
      const tags = buildTags();
      currentImage.categories[i]!.subcategories = tags;
      found = true;
      break;
    }
    if (!found) {
      const tags = buildTags();
      currentImage.categories.push({ name: category.name, subcategories: tags });
    }

    await sendAction({ action: "update", json: currentImage });
  }

  private async _displayCompletionMessage(): Promise<void> {
    const categoryContainer = document.getElementById("category-container");
    if (!categoryContainer) throw new Error("No category container found");
    categoryContainer.innerHTML = "<h2>All categories completed!</h2>";
  }

}

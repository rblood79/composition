import json,re,glob,sys
D=sys.argv[1]
s2=json.load(open(f"{D}/probe/s2props.json")); rac=json.load(open(f"{D}/probe/racprops.json")); ours=json.load(open(f"{D}/probe/ours.json")); rules=json.load(open(f"{D}/probe/rules.json"))
v3=[]
for f in glob.glob(f"{D}/survey/v3/*.d.ts"):
    src=open(f).read()
    for m in re.finditer(r"interface\s+(\w+)\b[^{]*\{",src):
        i=m.end(); depth=1; j=i
        while depth and j<len(src):
            depth+={"{":1,"}":-1}.get(src[j],0); j+=1
        v3.append((m.group(1),set(re.findall(r"\n\s+'?([A-Za-z][\w-]*)'?\??\s*:",src[i:j-1]))))
def v3has(comp,k): return any(k in props for n,props in v3 if comp.lower() in n.lower())
MAP={"Select":"Picker","Separator":"Divider","Tree":"TreeView","TreeItem":"TreeViewItem","GridList":"ListView","GridListItem":"ListViewItem","Table":"TableView","Toast":"ToastContainer","Nav":"SideNav","Kbd":"Keyboard","ListBoxItem":"PickerItem"}
EDITOR={"children","slot","dataBinding","aria-label"}
LINK={"href","target","rel","hrefLang","download","ping","referrerPolicy","routerOptions"}
STATE={"selectedKeys","defaultSelectedKeys","disabledKeys","expandedKeys","defaultExpandedKeys","selectedKey","defaultSelectedKey","isOpen","defaultOpen","defaultSelected","inputValue","defaultInputValue","focusedValue","defaultFocusedValue","sortDescriptor","selectedRoute","defaultItems","triggerRef","isEntering","value","defaultValue"}
BEHAV={"disallowEmptySelection","shouldSelectOnPressUp","keyboardNavigationBehavior","disallowTypeAhead","shouldCloseOnSelect","shouldFlip","autoFocus","preventFocusOnPress","keyboardActivation","isDateUnavailable","createCalendar","commitBehavior","focusMode","allowsArrowNavigation","getDropOperation","getTargetRect","UNSTABLE_focusOnEntry","isVirtualized","validationBehavior","shouldCloseOnPress","isKeyboardDismissDisabled","isNonModal","selectionBehavior","filter","textValue","formValue","name","role","labelElementType","itemProp","itemScope","itemType","itemID","itemRef","isHidden","renderActionBar","labelBehavior","formAction","formEncType","formMethod","formNoValidate","formTarget","autoCapitalize","validationErrors","render","inputRef","validate","form","excludeFromTabOrder","dependencies","items","renderValue","renderEmptyState","loadingState","dragAndDropHooks","disabledBehavior","shouldFocusWrap","escapeKeyBehavior","autoComplete","autoCorrect","spellCheck","enterKeyHint","inputMode","columns","decrementAriaLabel","incrementAriaLabel","groupActionLabel","hasChildItems","menuItems","treeColumn"}
def lits(t): return sorted(set(re.findall(r'"([^"]+)"',t)))
out=[]
for typ in sorted(ours):
    s2n=MAP.get(typ,typ); s2p=s2.get(s2n); racp=rac.get(typ,{})
    e={"type":typ,"s2":s2n if s2p else None,"same":[],"diff":[],"rac":[],"v3":[],"own":[],"editor":[],"s2vis":[],"s2link":[],"s2state":[],"s2behav":[]}
    for k,v in ours[typ].items():
        if k.startswith("_"): continue
        if k in EDITOR: e["editor"].append(k); continue
        if s2p and k in s2p:
            sl=lits(s2p[k]["type"]); ol=v.get("options")
            if not ol and v.get("kind") in ("variant","size"):
                ol=(rules.get(typ) or {}).get("variants" if v["kind"]=="variant" else "sizes") or None
            if ol and sl and sorted(ol)!=sl: e["diff"].append({"prop":k,"ours":ol,"s2":sl})
            else: e["same"].append(k)
        elif k in racp or k=="autoFocus": e["rac"].append(k)
        elif v3has(s2n,k) or v3has(typ,k) or (k=="isQuiet" and typ in ("DatePicker","SearchField")): e["v3"].append(k)
        else: e["own"].append(k)
    if s2p:
        for k in s2p:
            if k in ours[typ]: continue
            bucket="s2link" if k in LINK else "s2state" if k in STATE else "s2behav" if k in BEHAV else "s2vis"
            e[bucket].append(k)
    out.append(e)
json.dump(out,open(f"{D}/probe/dataset.json","w"),ensure_ascii=False,indent=1)
tot={k:sum(len(x[k]) for x in out) for k in ("same","diff","rac","v3","own","editor","s2vis","s2link","s2state","s2behav")}
print(tot, len(out), sum(1 for x in out if not x["s2"]))

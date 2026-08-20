from docx import Document
from docx.oxml.ns import qn

d = Document("SRS-He-thong-dat-ve-xe-khach-truc-tuyen.docx")
numbering = d.part.numbering_part.element
abstract_by_id = {int(x.get(qn("w:abstractNumId"))): x for x in numbering.findall(qn("w:abstractNum"))}
for num in numbering.findall(qn("w:num")):
    num_id = int(num.get(qn("w:numId")))
    abs_id = int(num.find(qn("w:abstractNumId")).get(qn("w:val")))
    abstract = abstract_by_id[abs_id]
    fmts = []
    texts = []
    for lvl in abstract.findall(qn("w:lvl")):
        fmt = lvl.find(qn("w:numFmt"))
        txt = lvl.find(qn("w:lvlText"))
        fmts.append(None if fmt is None else fmt.get(qn("w:val")))
        texts.append(None if txt is None else txt.get(qn("w:val")))
    print("NUM_DEF", num_id, "abstract", abs_id, "formats", fmts, "texts", texts)

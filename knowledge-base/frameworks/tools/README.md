Extraction scripts used to build this folder. Inputs are the NCA PDFs from the
"Frameworks" Drive folder, placed in `pdf/` next to these scripts; intermediate
files go to `out/`. Requires pdfplumber, Pillow and tesseract.

    python parse.py '{"parse":{"pdf_path":"pdf/ECC--2024-EN.pdf","body_x":156,"first_page":15,"last_page":34},"out":"out/ecc.json"}'
    python parse.py '{"parse":{"pdf_path":"pdf/Critical-Systems-Cybersecurity-Controls.pdf","body_x":153,"first_page":19,"last_page":30},"out":"out/cscc.json"}'
    python parse.py '{"parse":{"pdf_path":"pdf/CCC-2-2024-EN-.pdf","body_x":152,"first_page":16,"last_page":31},"out":"out/ccc.json"}'
    python parse.py '{"parse":{"pdf_path":"pdf/otcc_en.pdf","body_x":168,"right_max":418,"first_page":15,"last_page":36,"level_cols":415},"out":"out/otcc.json"}'
    python parse.py '{"parse":{"pdf_path":"pdf/telework_cybersecurity_controls-en.pdf","body_x":135,"first_page":13,"last_page":21},"out":"out/tcc.json"}'
    python parse.py '{"parse":{"pdf_path":"pdf/osmacc-en.pdf","body_x":135,"first_page":13,"last_page":19},"out":"out/osmacc.json"}'

    # DCC has no Unicode text layer: render pages 11-19 at 300 dpi, then OCR.
    pdftoppm -r 300 -gray -png -f 11 -l 19 pdf/Data-Cybersecurity-Controls-.pdf img/p
    python dcc_parse.py pdf/Data-Cybersecurity-Controls-.pdf img out/dcc.json

    # out/ecc_updates.json is Appendix (C) of ECC-2:2024 (pages 45-56, pdfplumber
    # extract_tables); out/site.json and out/site_reqrefs.json are the site's
    # current catalogue and requirement-model references.
    node site_dump.mjs > out/site.json
    python assemble.py ..        # writes data/, import/ and markdown/

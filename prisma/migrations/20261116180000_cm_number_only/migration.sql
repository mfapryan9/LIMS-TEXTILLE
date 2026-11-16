-- No. CM disimpan hanya angka (tanpa awalan "CM"), mis. "CM-102" -> "102"
UPDATE "samples"
SET "colorCode" = upper(regexp_replace(regexp_replace("colorCode", '^\s*(NO\.?\s*)?CM[\s\-.:]*', '', 'i'), '\s+', '', 'g'))
WHERE "colorCode" ~* '^\s*(NO\.?\s*)?CM';

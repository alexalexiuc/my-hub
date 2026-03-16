INSERT INTO "measurement_types" ("key", "label", "unit") VALUES
  ('weight',    'Weight',              'kg'),
  ('neck',      'Neck circumference',  'cm'),
  ('waist',     'Waist circumference', 'cm'),
  ('hips',      'Hips circumference',  'cm'),
  ('chest',     'Chest circumference', 'cm'),
  ('bicep',     'Bicep circumference', 'cm'),
  ('body_fat',  'Body fat',            '%')
ON CONFLICT ("key") DO NOTHING;

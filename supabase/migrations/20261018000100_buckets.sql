-- Limites nos próprios buckets privados (MUDANCAS-V2 §5 e §8): 10 MB e só os tipos aceitos pelo app.
update storage.buckets set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'media';
update storage.buckets set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] where id = 'documents';

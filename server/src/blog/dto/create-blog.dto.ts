import { IsString, MaxLength, IsOptional, IsArray, IsIn, ArrayMaxSize } from 'class-validator';

export class CreateBlogDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  @MaxLength(200000)
  content: string;

  @IsOptional()
  @IsIn(['published', 'draft'])
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @ArrayMaxSize(5)
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverImage?: string;
}

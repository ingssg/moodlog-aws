import { IsString, IsNotEmpty, IsDateString, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEntryDto {
  @IsIn(['happy', 'neutral', 'sad', 'angry', 'love'])
  mood!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsDateString()
  date!: string;
}

export class GetEntriesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['happy', 'neutral', 'sad', 'angry', 'love'])
  mood?: string;
}

export class DemoEntryDto {
  @IsIn(['happy', 'neutral', 'sad', 'angry', 'love'])
  mood!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
